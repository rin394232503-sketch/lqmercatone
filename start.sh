#!/bin/bash
echo ""
echo "🛍️  L&Qmercatone 商城启动中..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖..."
  npm install
  echo ""
fi

# Kill any existing process on port 3000
kill $(lsof -t -i:3000) 2>/dev/null

echo "🚀 启动服务器..."
node server.js
