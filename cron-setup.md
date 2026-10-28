# 定时任务配置说明

## 方式 1: Linux Cron (推荐)

编辑 crontab:
```bash
crontab -e
```

添加以下行（每小时运行一次）:
```cron
0 * * * * cd /home/admin/wuying-agent-workspace/lqmercatone && node auto-cancel-timeout.js >> logs/auto-cancel.log 2>&1
```

## 方式 2: 集成到每日巡检

在现有的每日巡检任务中添加调用:
```javascript
// 在巡检脚本中
await import('./auto-cancel-timeout.js');
```

## 方式 3: Supabase Edge Function (高级)

创建 Supabase Edge Function:
```typescript
// supabase/functions/auto-cancel/index.ts
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

serve(async () => {
  // 调用 auto-cancel-timeout.js 的逻辑
  const orders = await getTimeoutOrders();
  for (const order of orders) {
    await cancelOrderAndReleaseStock(order);
  }
  return new Response('OK');
});
```

设置 cron job:
```bash
supabase functions deploy auto-cancel
# 在 Supabase Dashboard 设置定时触发
```

## 监控

日志位置: `/home/admin/wuying-agent-workspace/lqmercatone/logs/auto-cancel.log`

查看最近执行:
```bash
tail -100 logs/auto-cancel.log
```

查看今天的关单数:
```bash
grep "$(date +%Y-%m-%d)" logs/auto-cancel.log | grep "✅" | wc -l
```
