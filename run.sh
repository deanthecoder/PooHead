#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 - <<'PY'
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

with ThreadingHTTPServer(("127.0.0.1", 0), SimpleHTTPRequestHandler) as server:
    print(f"Open http://127.0.0.1:{server.server_port}/ in your browser", flush=True)
    server.serve_forever()
PY
