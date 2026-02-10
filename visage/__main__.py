"""CLI entry point: python -m visage"""

import argparse
import sys

from visage.app import VisageApp
from visage.style import load_style


def main():
    parser = argparse.ArgumentParser(
        description="visage — animated face renderer for MocapFrame streams"
    )
    parser.add_argument(
        "--backend", default="pygame_aw", help="renderer backend (default: pygame_aw)"
    )
    parser.add_argument("--width", type=int, default=800, help="window width")
    parser.add_argument("--height", type=int, default=600, help="window height")
    parser.add_argument("--style", type=str, default=None, help="path to style JSON")
    args = parser.parse_args()

    style = None
    if args.style:
        style = load_style(args.style)

    app = VisageApp(
        backend=args.backend,
        width=args.width,
        height=args.height,
        style=style,
    )

    try:
        app.run()
    except KeyboardInterrupt:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
