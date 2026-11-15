#!/usr/bin/env bash
# 守护启动：服务器 + Cloudflare 快速隧道（崩溃自动重启）
cd "$(dirname "$0")"
mkdir -p logs
( while true; do node server.js >> logs/server.log 2>&1; echo "[$(date)] server exited, restarting" >> logs/server.log; sleep 2; done ) &
echo $! > logs/server-supervisor.pid
if [ "${TUNNEL:-0}" = "1" ]; then
( while true; do cloudflared tunnel --no-autoupdate --url http://127.0.0.1:${PORT:-8787} >> logs/tunnel.log 2>&1; echo "[$(date)] tunnel exited, restarting" >> logs/tunnel.log; sleep 5; done ) &
echo $! > logs/tunnel-supervisor.pid
fi
