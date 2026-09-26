#!/bin/bash
# Sandbox dev-server helper: probe -> bootstrap if dead -> run command
# Usage: qa-run.sh "<shell command using curl>"
PORT=3000
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:$PORT/api/health 2>/dev/null)
if [ "$code" != "200" ]; then
  cd /home/z/my-project
  setsid nohup bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
  for i in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:$PORT/api/health 2>/dev/null)
    [ "$code" = "200" ] && break
    sleep 1
  done
fi
echo "[dev] health:$code"
bash -c "$1"
