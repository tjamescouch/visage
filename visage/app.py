"""Main application — wires receiver, face model, and renderer backend."""

from visage.receiver import MocapReceiver
from visage import face_model
from visage.style import default_style
from visage.backend import load_backend


class VisageApp:
    """Animated face renderer consuming MocapFrame streams."""

    def __init__(
        self,
        backend: str = "pygame_aw",
        width: int = 800,
        height: int = 600,
        style: dict | None = None,
    ):
        self.receiver = MocapReceiver()
        self.style = style or default_style()
        self.backend_name = backend
        self.width = width
        self.height = height

    def run(self):
        """Start the render loop. Blocks until quit."""
        renderer = load_backend(self.backend_name)
        renderer.init(self.width, self.height, self.style)
        self.receiver.start()

        try:
            while True:
                if not renderer.handle_events():
                    break

                frame = self.receiver.latest()
                size = renderer.get_size()
                geometry = face_model.compute(frame.pts, size, self.style)
                renderer.render(geometry, self.style)
                renderer.present()
        finally:
            self.receiver.stop()
            renderer.cleanup()
