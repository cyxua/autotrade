#!/bin/bash
echo "🚀 AutoTrade 시작 중..."
docker start autotrade_pg autotrade_redis
sleep 2
fuser -k 4000/tcp 2>/dev/null
sleep 1
cd /workspaces/autotrade/backend
npm run start:dev &
sleep 8
cd /workspaces/autotrade/frontend
npm run dev
