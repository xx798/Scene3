# 外部定时触发接口说明

## 背景

项目运行在 FaaS（函数计算）平台上，无人访问时实例会自动休眠，导致内存中的定时任务（CronJob）丢失。

通过外部定时服务（如 GitHub Actions）每分钟调用本接口，由应用层判断哪些任务到期并执行，彻底解决 FaaS 休眠导致定时任务不生效的问题。

## 接口信息

### 触发到期任务

```
POST /api/scheduled-tasks/trigger-due
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `window` | number | 否 | 5 | 补偿窗口（分钟）。在此窗口内到期但未执行的任务都会被补执行 |

**请求头（可选）**

| Header | 说明 |
|--------|------|
| `Authorization: Bearer <token>` | 鉴权令牌，仅当服务端配置了 `CRON_TRIGGER_TOKEN` 环境变量时需要 |

**响应示例**

```json
{
  "success": true,
  "checked": 3,
  "triggered": 1,
  "tasks": [
    { "id": 1, "name": "摄像头A诊断", "status": "triggered" },
    { "id": 2, "name": "摄像头B诊断", "status": "not_due" },
    { "id": 3, "name": "周报生成", "status": "not_due" }
  ]
}
```

**tasks 中 status 字段说明**

| 值 | 含义 |
|----|------|
| `triggered` | 任务到期，已触发执行 |
| `not_due` | 任务未到期，跳过 |
| `skipped_running` | 任务到期但正在执行中，跳过（防止并发） |

**错误响应**

```json
// 401 - 鉴权失败（配置了 CRON_TRIGGER_TOKEN 但未携带或错误）
{ "error": "未授权" }

// 500 - 服务异常
{ "error": "触发失败", "detail": "具体错误信息" }
```

---

### 健康检查

```
GET /api/health
```

用于外部心跳探活，保持 FaaS 实例不休眠。

**响应示例**

```json
{
  "status": "ok",
  "timestamp": "2026-08-03T07:48:00.000Z"
}
```

---

## 工作原理

```
外部 cron（每分钟）
  │
  │  POST /api/scheduled-tasks/trigger-due?window=5
  ▼
FaaS 平台
  │
  │  实例休眠？→ 自动冷启动（10~30秒）
  │  实例活跃？→ 直接处理
  ▼
接口逻辑
  │
  ├─ 1. 查询 scheduled_tasks 表（is_active = true）
  ├─ 2. 逐个检查 cron 表达式是否在当前时间窗口内到期
  ├─ 3. 对比 last_run_at，确认今天是否已执行过
  ├─ 4. 到期的任务 → 调用 executeTask() 执行
  └─ 5. 返回检查结果
```

## 冷启动补偿机制

当 FaaS 实例休眠时，冷启动可能需要 10~30 秒。接口使用**时间窗口**而非精确时间点来判断任务是否到期：

- 默认窗口：5 分钟
- 例如：任务 cron 为 `0 9 * * *`（每天 9:00），当前时间 9:03
  - 窗口覆盖 8:58 ~ 9:03
  - 9:00 在窗口内 → 任务到期 → 执行

即使冷启动延迟，只要补偿窗口内有过触发点，任务就不会漏执行。

## GitHub Actions 配置

### 1. 推送工作流文件

将 `.github/workflows/scheduled-tasks-trigger.yml` 推送到仓库。

### 2. 配置 GitHub Secrets

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret | 说明 | 示例 |
|--------|------|------|
| `APP_DOMAIN` | **必填**。应用域名（不含协议） | `example.dev.coze.site` |
| `CRON_TRIGGER_TOKEN` | 可选。鉴权令牌，需与服务端环境变量一致 | `my-secret-token-123` |

### 3. 配置服务端环境变量（可选）

如果设置了 `CRON_TRIGGER_TOKEN`，需要在 FaaS 平台的环境变量中也配置相同的值。

## 用户操作与接口行为

用户在"定时任务管理"页面的操作会**立即生效**，无需额外同步：

| 用户操作 | 下次接口调用时 |
|----------|---------------|
| 新建任务 | 立即纳入检查范围 |
| 删除任务 | 不再检查 |
| 修改 cron 表达式 | 按新表达式判断 |
| 暂停任务 | 跳过（is_active = false） |
| 恢复任务 | 恢复检查 |

## 常见问题

**Q: 外部 cron 每分钟调用一次，会不会产生大量无效请求？**

A: 大部分时候确实没有到期任务，接口会快速返回 `{"triggered": 0}`。这是用少量无效请求换取定时可靠性的 trade-off。FaaS 平台按调用次数计费，成本极低。

**Q: 如果 GitHub Actions 延迟或失败怎么办？**

A: 补偿窗口默认 5 分钟。即使某次调用失败，下一分钟会重试，5 分钟内的到期任务都会被补执行。

**Q: 实例冷启动需要 30 秒，会不会超时？**

A: 不会。冷启动完成后接口正常处理请求并返回结果。外部 cron 等待响应即可，不存在超时问题。
