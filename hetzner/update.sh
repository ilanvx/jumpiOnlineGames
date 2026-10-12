#!/usr/bin/env bash
# Jumpi Games: puts the newest code from GitHub live on this server.   bash ~/update.sh
#   bash ~/update.sh now   → restart right away (no 1-minute note for the players)
set -euo pipefail
cd ~/jumpi
# does the code that's running now know the "update in a minute" signal? (checked before pulling the new code)
NOTICE=0; grep -q SIGUSR2 server.js && NOTICE=1
git pull --ff-only
npm ci --omit=dev
if [ "$NOTICE" = 1 ] && [ "${1:-}" != "now" ] && pm2 describe jumpi >/dev/null 2>&1; then
  pm2 sendSignal SIGUSR2 jumpi >/dev/null && echo "Players were told: an update in 1 minute. Waiting 60 seconds…" && sleep 60
fi
pm2 restart jumpi --update-env
sleep 3
curl -s -o /dev/null -w "local web page: HTTP %{http_code}\n" http://localhost:3000/ || true
