"""'Another World' flat-polygon Pygame renderer.

Eric Chahi-inspired visual style: angular polygons, two-tone face with
directional shadow, no anti-aliasing, muted cinematic palette.
"""

import pygame
from visage.backend import register


class PygameAWRenderer:
    """Flat-shaded polygon renderer in the style of Another World (1991)."""

    def __init__(self):
        self._screen = None
        self._clock = None
        self._width = 0
        self._height = 0
        self._debug = False
        self._scanlines = False

    def init(self, width: int, height: int, style: dict) -> None:
        pygame.init()
        self._width = width
        self._height = height
        self._screen = pygame.display.set_mode((width, height), pygame.RESIZABLE)
        pygame.display.set_caption("visage — Another World")
        self._clock = pygame.time.Clock()

    def render(self, geometry: dict, style: dict) -> None:
        screen = self._screen
        screen.fill(style["bg"])

        # Face lit side
        if "face_lit" in geometry:
            pygame.draw.polygon(screen, style["skin_lit"], geometry["face_lit"])

        # Face shadow (right half)
        if "face_shadow" in geometry:
            pygame.draw.polygon(screen, style["skin_shadow"], geometry["face_shadow"])

        # Eyes
        for prefix in ("left", "right"):
            key = f"{prefix}_eye"
            if key in geometry:
                pygame.draw.polygon(screen, style["eye_white"], geometry[key])

            # Iris
            iris_key = f"{prefix}_iris"
            if iris_key in geometry:
                center, radius = geometry[iris_key]
                if radius > 0:
                    pygame.draw.circle(screen, style["iris"], center, radius)

            # Pupil
            pupil_key = f"{prefix}_pupil"
            if pupil_key in geometry:
                center, radius = geometry[pupil_key]
                if radius > 0:
                    pygame.draw.circle(screen, style["pupil"], center, radius)

            # Highlight
            hl_key = f"{prefix}_highlight"
            if hl_key in geometry:
                center, radius = geometry[hl_key]
                if radius > 0:
                    pygame.draw.circle(screen, style["highlight"], center, radius)

        # Brows — thick angular lines
        for prefix in ("left", "right"):
            brow_key = f"{prefix}_brow"
            if brow_key in geometry:
                p1, p2 = geometry[brow_key]
                pygame.draw.line(screen, style["brow"], p1, p2, 3)

        # Mouth interior (drawn first, behind lips)
        if geometry.get("mouth_interior"):
            pygame.draw.polygon(screen, style["mouth_interior"], geometry["mouth_interior"])

        # Mouth upper lip
        if "mouth_upper" in geometry:
            pygame.draw.polygon(screen, style["mouth"], geometry["mouth_upper"])

        # Mouth lower lip
        if "mouth_lower" in geometry:
            pygame.draw.polygon(screen, style["mouth"], geometry["mouth_lower"])

        # Scanline overlay (toggle with S key)
        if self._scanlines:
            self._draw_scanlines(screen)

        # Debug overlay (toggle with D key)
        if self._debug:
            self._draw_debug(screen, geometry)

    def present(self) -> None:
        pygame.display.flip()
        self._clock.tick(60)

    def handle_events(self) -> bool:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE or event.key == pygame.K_q:
                    return False
                elif event.key == pygame.K_d:
                    self._debug = not self._debug
                elif event.key == pygame.K_s:
                    self._scanlines = not self._scanlines
            elif event.type == pygame.VIDEORESIZE:
                self._width = event.w
                self._height = event.h
                self._screen = pygame.display.set_mode(
                    (event.w, event.h), pygame.RESIZABLE
                )
        return True

    def cleanup(self) -> None:
        pygame.quit()

    def get_size(self) -> tuple[int, int]:
        return (self._width, self._height)

    # --- Internal ---

    def _draw_scanlines(self, screen):
        overlay = pygame.Surface((self._width, self._height), pygame.SRCALPHA)
        for y in range(0, self._height, 3):
            pygame.draw.line(overlay, (0, 0, 0, 40), (0, y), (self._width, y))
        screen.blit(overlay, (0, 0))

    def _draw_debug(self, screen, geometry):
        font = pygame.font.SysFont("monospace", 12)
        y = 8
        for key, val in geometry.items():
            if val is None:
                continue
            label = font.render(f"{key}", True, (100, 200, 100))
            screen.blit(label, (8, y))
            y += 14

            # Draw vertex markers for polygon keys
            if isinstance(val, list):
                for pt in val:
                    if isinstance(pt, tuple) and len(pt) == 2:
                        pygame.draw.circle(screen, (255, 80, 80), pt, 2)
            elif isinstance(val, tuple) and len(val) == 2:
                center, radius = val
                if isinstance(center, tuple) and isinstance(radius, int):
                    pygame.draw.circle(screen, (255, 80, 80), center, 2)


# Auto-register on import
register("pygame_aw", PygameAWRenderer)
