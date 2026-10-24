#!/bin/sh
set -eu
cd "$(dirname "$0")"
echo "Open http://localhost:8765/ in your browser"
python3 -m http.server 8765 --bind 127.0.0.1
