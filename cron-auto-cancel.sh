#!/bin/bash
# L&Qmercatone 超时订单自动关单 Cron 脚本
# 建议每小时运行一次

LOG_DIR="/home/admin/wuying-agent-workspace/lqmercatone/logs"
mkdir -p $LOG_DIR

LOG_FILE="$LOG_DIR/auto-cancel-$(date +%Y-%m-%d).log"

echo "[$(date)] 开始执行超时关单..." >> $LOG_FILE

curl -s -X POST http://localhost:3000/api/orders/auto-cancel-timeout \
  >> $LOG_FILE 2>&1

echo "[$(date)] 执行完成" >> $LOG_FILE
echo "---" >> $LOG_FILE
