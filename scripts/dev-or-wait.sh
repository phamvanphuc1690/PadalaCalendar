#!/bin/sh
# Start dev server if not already running, otherwise just hold open
PORT=${PORT:-3003}
if nc -z localhost $PORT 2>/dev/null; then
  echo "Server already on :$PORT — holding for playwright"
  exec tail -f /dev/null
else
  exec pnpm run dev
fi
