"""Renderer backend protocol and plugin registry."""

from typing import Protocol


class Renderer(Protocol):
    """Abstract renderer backend. Implement this to add a new visual style."""

    def init(self, width: int, height: int, style: dict) -> None:
        """Initialize the rendering surface."""
        ...

    def render(self, geometry: dict, style: dict) -> None:
        """Draw one frame from computed geometry."""
        ...

    def present(self) -> None:
        """Flip/present the rendered frame to the display."""
        ...

    def handle_events(self) -> bool:
        """Process input events. Return False to quit."""
        ...

    def cleanup(self) -> None:
        """Release rendering resources."""
        ...

    def get_size(self) -> tuple[int, int]:
        """Return current (width, height) of the render target."""
        ...


# Plugin registry: name → class
_BACKENDS: dict[str, type] = {}


def register(name: str, cls: type):
    _BACKENDS[name] = cls


def load_backend(name: str) -> Renderer:
    if name not in _BACKENDS:
        # Try importing built-in backends
        if name == "pygame_aw":
            from visage.backends import pygame_aw  # noqa: F401
        else:
            raise ValueError(f"Unknown backend '{name}'. Available: {list(_BACKENDS.keys())}")
    if name not in _BACKENDS:
        raise ValueError(f"Backend '{name}' failed to register.")
    return _BACKENDS[name]()
