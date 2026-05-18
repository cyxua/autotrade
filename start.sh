#!/bin/bash
echo "🚀 AutoTrade 시작 중..."

# DB + Redis
docker start autotrade_pg autotrade_redis
sleep 2

# 포트 정리
fuser -k 4000/tcp 2>/dev/null
sleep 1

# 백엔드 빌드 및 실행
cd /workspaces/autotrade/backend
npm run build 2>&1 | tail -3
# nest-cli sourceRoot:src → dist/main.js (dist/src/main.js 아님)
npm run start:prod &
sleep 5

# 프론트엔드
cd /workspaces/autotrade/frontend
npm run dev &

echo "✅ 시작 완료 (백엔드 :4000 / 프론트 :3000)"
