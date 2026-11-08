"""Static server for the browser benchmark, with the COOP/COEP headers that multi-threaded WASM needs."""
import functools
import http.server
from pathlib import Path


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_PUT(self) -> None:
        # Lets bench.html save its generated audio into samples/web/ for the Whisper check.
        name = Path(self.path).name
        if not name.endswith(".wav"):
            self.send_error(400)
            return
        out = Path(__file__).parent / "samples" / "web"
        out.mkdir(parents=True, exist_ok=True)
        (out / name).write_bytes(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(204)
        self.end_headers()


Handler.extensions_map = {**Handler.extensions_map, ".mjs": "text/javascript", ".wasm": "application/wasm"}

if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(Path(__file__).parent))
    http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler).serve_forever()
