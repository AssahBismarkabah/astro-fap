#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

rsvg-convert -w 2400 -h 1720 \
  src/agent-runtime-industry-v3.svg \
  -o dist/agent-runtime-industry-v3.png

echo "Exported dist/agent-runtime-industry-v3.png"
