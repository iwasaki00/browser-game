from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


HOST = "0.0.0.0"
PORT = 8000
ROOT = Path(__file__).resolve().parent


class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    server = ThreadingHTTPServer((HOST, PORT), StaticHandler)
    print(f"Serving {ROOT} at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
