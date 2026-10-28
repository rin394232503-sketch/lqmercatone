# 超时自动关单 Cron 配置

## 快速设置

### 1. 添加 Cron 任务（每小时执行一次）

```bash
crontab -e
```

添加以下行：

```cron
0 * * * * ./cron-auto-cancel.sh
```

### 2. 手动执行测试

```bash
cd /home/admin/wuying-agent-workspace/lqmercatone
./cron-auto-cancel.sh
```

### 3. 查看日志

```bash
# 今天的日志
tail -50 logs/auto-cancel-$(date +%Y-%m-%d).log

# 所有日志
ls -la logs/auto-cancel-*.log
```

## 工作原理

1. Cron 每小时触发 `cron-auto-cancel.sh`
2. 脚本调用后端 API: `POST /api/orders/auto-cancel-timeout`
3. 后端查找所有 `status='pending'` 且 `created_at < 24小时前` 的订单
4. 批量更新订单状态为 `cancelled`
5. 释放锁定的库存（stock + N）
6. 记录操作日志
7. 返回执行结果

## 监控

### 查看今天的关单数
```bash
grep "已关闭" logs/auto-cancel-$(date +%Y-%m-%d).log | wc -l
```

### 查看最近执行
```bash
tail -20 logs/auto-cancel-$(date +%Y-%m-%d).log
```

### 设置告警（可选）
```bash
# 如果关单数超过 10，发送邮件告警
0 * * * * cd /home/admin/wuying-agent-workspace/lqmercatone && ./cron-auto-cancel.sh && (grep "已关闭" logs/auto-cancel-$(date +%Y-%m-%d).log | wc -l | awk '{if($1>10) print "⚠️ 今天已关闭"$1"个超时订单"}')
```

## 注意事项

⚠️ **重要**: 
- 确保后端服务 (server.js) 正在运行
- 确保数据库连接正常
- 定期清理日志文件（建议保留 30 天）

 **建议**:
- 初期每小时执行一次
- 观察一周后，如果订单量少可改为每 4 小时
- 节假日可临时调整为每 2 小时

