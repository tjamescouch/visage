#!/usr/bin/env python3
"""Visage — animated LLM avatar face with sentiment-driven expressions."""

import argparse
import json
import math
import time

import pygame
import numpy as np

from face import FaceModel, FaceStyle, PARAM_NAMES
from interp import AnimationBlender, IdleAnimator
from protocol import SignalListener, TokenStreamWatcher
from brain import SentimentBrain


class VisageApp:
    def __init__(self, width=600, height=600, style=None,
                 watch_file=None):
        pygame.init()
        self.width = width
        self.height = height
        self.screen = pygame.display.set_mode((width, height), pygame.RESIZABLE)
        pygame.display.set_caption("Visage")
        self.clock = pygame.time.Clock()

        self.face = FaceModel(style)
        self.blender = AnimationBlender()
        self.idle = IdleAnimator()
        self.brain = SentimentBrain()
        self.listener = SignalListener()

        self.watcher = None
        if watch_file:
            self.watcher = TokenStreamWatcher(watch_file)

    def run(self):
        self.listener.start()
        if self.watcher:
            self.watcher.start()
        running = True
        last = time.time()

        while running:
            now = time.time()
            dt = min(now - last, 0.05)
            last = now

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key == pygame.K_1:
                        self.blender.push_expression("idle")
                    elif event.key == pygame.K_2:
                        self.blender.push_expression("thinking")
                    elif event.key == pygame.K_3:
                        self.blender.push_expression("talking", decay_rate=0.0)
                        self.idle.is_talking = True
                    elif event.key == pygame.K_4:
                        self.blender.push_expression("happy")
                    elif event.key == pygame.K_5:
                        self.blender.push_expression("sad")
                    elif event.key == pygame.K_6:
                        self.blender.push_expression("surprised")
                    elif event.key == pygame.K_7:
                        self.blender.push_expression("confused")
                    elif event.key == pygame.K_0:
                        # Reset to idle
                        self.blender.layers.clear()
                        self.idle.is_talking = False
                elif event.type == pygame.VIDEORESIZE:
                    self.width, self.height = event.w, event.h

            # Poll explicit expression signals
            sig = self.listener.poll()
            if sig:
                self.blender.push_expression(sig.expression, sig.intensity)

            # Poll token stream and feed brain
            if self.watcher:
                for chunk in self.watcher.poll_all():
                    self.brain.feed(chunk.text, chunk.timestamp)

            # Step the brain
            self.brain.step(dt, now)
            self.idle.is_talking = self.brain.emotion.talking

            # Push brain emotion into blender
            if abs(self.brain.emotion.valence) > 0.05 or self.brain.emotion.arousal > 0.05:
                self.blender.push_sentiment(
                    self.brain.emotion.valence,
                    self.brain.emotion.arousal,
                    decay_rate=0.08
                )

            # Blend all animation layers
            params = self.blender.step(dt)
            # Idle overlay (breathing, blinking, drift — always on)
            params = self.idle.step(params, dt)
            self.face.set_params(params)

            # Render
            self.screen.fill(self.face.style.bg_color)
            self._render()

            # Debug overlay
            self._render_debug(now)

            pygame.display.flip()
            self.clock.tick(60)

        self.listener.stop()
        if self.watcher:
            self.watcher.stop()
        pygame.quit()

    def _render_debug(self, now):
        """Show emotion state and active layers."""
        font = pygame.font.SysFont("Monaco", 12)
        y = 8
        e = self.brain.emotion
        color = (100, 100, 120)

        lines = [
            f"valence: {e.valence:+.2f}  arousal: {e.arousal:.2f}  talking: {e.talking}",
            f"layers: {', '.join(f'{l.name}({l.weight:.2f})' for l in self.blender.layers)}",
        ]
        for line in lines:
            surf = font.render(line, True, color)
            self.screen.blit(surf, (8, y))
            y += 16

    def _render(self):
        s = self.face.style
        w, h = self.width, self.height
        cx, cy = w // 2, h // 2
        p = self.face.p

        scale = p("face_scale")
        fw = int(s.face_width * w * scale)
        fh = int(s.face_height * h * scale)

        # Face outline
        face_rect = pygame.Rect(cx - fw // 2, cy - fh // 2, fw, fh)
        pygame.draw.ellipse(self.screen, s.face_color, face_rect)
        pygame.draw.ellipse(self.screen, s.brow_color, face_rect, s.line_width)

        # Eyes
        for side, prefix in [(-1, "left"), (1, "right")]:
            ex = cx + int(side * s.eye_spacing * w)
            ey = cy - int((0.5 - s.eye_y) * fh)

            openness = p(f"{prefix}_eye_openness")
            erx = int((s.eye_rx + p(f"{prefix}_eye_rx")) * w)
            ery = int((s.eye_ry + p(f"{prefix}_eye_ry")) * h * max(0.05, openness))

            # Eye white
            eye_rect = pygame.Rect(ex - erx, ey - ery, erx * 2, ery * 2)
            pygame.draw.ellipse(self.screen, (240, 240, 245), eye_rect)
            pygame.draw.ellipse(self.screen, s.brow_color, eye_rect, 2)

            # Iris
            iris_r = int(s.pupil_radius * 1.8 * min(w, h))
            pdx = int(p(f"{prefix}_pupil_dx") * w)
            pdy = int(p(f"{prefix}_pupil_dy") * h)
            pygame.draw.circle(self.screen, s.eye_color, (ex + pdx, ey + pdy), iris_r)

            # Pupil
            pr = int(s.pupil_radius * min(w, h))
            pygame.draw.circle(self.screen, s.pupil_color, (ex + pdx, ey + pdy), pr)

            # Highlight
            hr = max(2, pr // 3)
            pygame.draw.circle(self.screen, (255, 255, 255),
                               (ex + pdx - pr // 3, ey + pdy - pr // 3), hr)

        # Eyebrows
        for side, prefix in [(-1, "left"), (1, "right")]:
            bx = cx + int(side * s.eye_spacing * w)
            by = cy - int((0.5 - s.eye_y) * fh) + int(s.brow_y_offset * h)
            by += int(p(f"{prefix}_brow_height") * h)
            angle = p(f"{prefix}_brow_angle")
            bw = int(s.brow_width * w)
            dx = int(math.cos(angle) * bw)
            dy = int(math.sin(angle) * bw)
            pygame.draw.line(self.screen, s.brow_color,
                             (bx - dx, by - dy), (bx + dx, by + dy),
                             s.line_width + 1)

        # Mouth
        mx = cx
        my = cy + int((s.mouth_y - 0.5) * fh)
        mw = int((s.mouth_width + p("mouth_width")) * w)
        curve = p("mouth_curve")
        openness = p("mouth_openness")

        points = []
        n_seg = 20
        for i in range(n_seg + 1):
            t = i / n_seg
            x = mx - mw + 2 * mw * t
            y = my - curve * h * 0.5 * math.sin(t * math.pi)
            points.append((int(x), int(y)))

        if len(points) > 1:
            pygame.draw.lines(self.screen, s.mouth_color, False, points, s.line_width)

        if openness > 0.02:
            mouth_h = int(openness * h * 0.15)
            bottom_points = []
            for i in range(n_seg + 1):
                t = i / n_seg
                x = mx - mw + 2 * mw * t
                y = my - curve * h * 0.5 * math.sin(t * math.pi) + mouth_h
                bottom_points.append((int(x), int(y)))
            poly = points + list(reversed(bottom_points))
            if len(poly) > 2:
                pygame.draw.polygon(self.screen, (80, 30, 40), poly)
                pygame.draw.polygon(self.screen, s.mouth_color, poly, 2)


def main():
    parser = argparse.ArgumentParser(description="Visage - Animated LLM Avatar")
    parser.add_argument("--width", type=int, default=600)
    parser.add_argument("--height", type=int, default=600)
    parser.add_argument("--style", type=str, default=None,
                        help="Path to style JSON file")
    parser.add_argument("--watch", type=str, default=None,
                        help="Path to token stream file to watch (tail -f style)")
    args = parser.parse_args()

    style = None
    if args.style:
        with open(args.style) as f:
            data = json.load(f)
        for key in data:
            if isinstance(data[key], list):
                data[key] = tuple(data[key])
        style = FaceStyle(**data)

    app = VisageApp(width=args.width, height=args.height,
                    style=style, watch_file=args.watch)
    app.run()


if __name__ == "__main__":
    main()
