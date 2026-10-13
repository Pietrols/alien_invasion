#!/usr/bin/env python3
"""Launch Void Runner locally with Python's standard library; no pip install."""
import argparse
import functools
import http.server
from pathlib import Path
import threading
import webbrowser


def main():
    parser = argparse.ArgumentParser(description="Launch Space Invasion: Void Runner")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parent))
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        parser.exit(1, f"Could not start the game server: {error}\nTry another port with --port 8001.\n")
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Void Runner ready: {url}\nPress Ctrl+C to stop.", flush=True)
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
