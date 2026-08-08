from __future__ import annotations

import argparse
from aiohttp import web

from .service import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Alarm Management API simulator.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    web.run_app(create_app(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
