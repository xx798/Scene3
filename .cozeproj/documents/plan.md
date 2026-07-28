# 定时任务暂停/恢复功能

## 概述

为定时任务管理页新增暂停/恢复切换按钮（运行态显示暂停图标，暂停态显示运行图标），暂停时强制中止正在执行的任务（AbortController），手动触发按钮独立于启停状态始终可用。平台：web。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 启停交互 | 单按钮切换（Pause/Play 图标） | 用户明确要求合并为一个键，状态视觉差异清晰 |
| 恢复行为 | 仅恢复 cron 调度，不自动触发 | 启动与手动触发分离，避免意外调用 |
| 手动触发 | 始终可用，不受 is_active 限制 | 暂停态下仍可单次执行，force 参数绕过检查 |
| 运行中任务中止 | AbortController 强制中止 | 用户明确要求，中途打断 HTTP 请求 |
| 任务执行状态追踪 | Map<taskId, AbortController> 内存追踪 | 轻量级，无需额外数据库字段 |

## 功能模块

### 1. 调度引擎中止能力（scheduler.ts）

- 新增 `runningControllers: Map<number, AbortController>` 追踪执行中任务
- `executeTask(taskId, options?)` 增加 `force?: boolean` 参数，`force=true` 时跳过 `is_active` 检查
- `executeDiagnosisTask` 内部将 AbortController 传递给 `callCozeBot` / `callCozeWorkflow`，在关键 await 点检查 `signal.aborted`
- 新增 `abortTask(taskId): boolean` — 中止指定任务的 AbortController，返回是否成功中止
- `stopTask` 调用时同时 abort（停用=不再调度+中止当前执行）

### 2. API 层调整

- **PUT `/api/scheduled-tasks/[id]`**：当 `is_active` 从 true→false 时，调用 `abortTask(id)` 中止运行中任务
- **POST `/api/scheduled-tasks/[id]/trigger`**：调用 `executeTask(id, { force: true })` 绕过 is_active 检查

### 3. 前端 UI（scheduled-tasks/page.tsx）

**按钮布局（操作列）**：
```
[启停切换] [手动触发] [日志] [编辑] [删除]
```

| 任务状态 | 启停按钮 | 手动触发按钮 | 状态 Badge |
|----------|----------|-------------|-----------|
| 运行中 (is_active=true) | Pause 图标，hover 红色 | Zap 图标，始终可用 | 绿色"运行中" |
| 暂停 (is_active=false) | Play 图标，hover 绿色 | Zap 图标，始终可用 | 灰色"已暂停" |
| 执行中 (有 running log) | 不影响启停 | 禁止重复触发 | 蓝色脉冲"执行中" |

**视觉差异化**：
- 启停按钮：`variant="outline"` + Pause/Play 图标
- 手动触发按钮：`variant="ghost"` + Zap（闪电）图标，与启停的 Play 图标明显区分
- 执行中状态：Badge 带脉冲动画 + Spinner

## 是否有原型设计

是

## 实施步骤

### 阶段一：原型设计
1. 加载 design-canvas 技能，设计定时任务管理页原型，重点展示启停切换按钮、手动触发按钮的图标差异与三种状态（运行中/暂停/执行中）的视觉变化

### 阶段二：代码开发
2. 改造调度引擎：scheduler.ts 增加 AbortController 追踪、abortTask 函数、executeTask 的 force 参数，callCozeBot/callCozeWorkflow 接入 abort signal
3. 改造 API 层：PUT 路由暂停时调用 abortTask，trigger 路由传 force=true 绕过 is_active 检查
4. 改造前端页面：scheduled-tasks/page.tsx 替换状态点击为独立启停按钮，新增 Zap 图标手动触发按钮，状态 Badge 支持执行中脉冲态
5. 执行代码检查与接口测试，验证暂停中止、恢复调度、暂停态手动触发三个核心场景

## 页面规格

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页
- @page(/history) 诊断记录
- @page(/reports) 报告下载
- @page(/scheduled-tasks) 定时任务

##### @page(/scheduled-tasks) 定时任务管理

**核心职责**：管理定时诊断任务的创建、启停、手动触发与日志查看。
**访问路径**：顶部导航直达。
**布局**：页面标题 + 新建按钮 → 任务列表 Table（任务名称 / 类型 / Cron / 状态 / 上次执行 / 操作列）→ 创建编辑 Dialog → 日志 Dialog。

**列表项字段**：任务名称 / 类型（智能体|工作流） / Cron 表达式 / 状态 / 上次执行时间

**状态**：
- 空态：显示"暂无定时任务，点击新建任务创建"
- 加载态：Spinner 居中

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 新建任务按钮 | 点击 | 打开创建 Dialog | — | — |
| 启停切换按钮 | 点击 | PUT is_active 取反；暂停时同时中止运行中任务 | is_active: boolean | 运行态显示 Pause 图标 hover 红，暂停态显示 Play 图标 hover 绿 |
| 手动触发按钮 | 点击 | POST trigger，force=true 绕过暂停限制 | — | Zap 图标，与启停 Play 图标区分；执行中时禁止重复点击 |
| 日志按钮 | 点击 | 打开日志 Dialog，GET logs?limit=20 | task_id | — |
| 编辑按钮 | 点击 | 打开编辑 Dialog，预填表单 | — | — |
| 删除按钮 | 点击 | confirm 确认后 DELETE | — | — |
| 状态 Badge | — | 运行中=绿色 / 已暂停=灰色 / 执行中=蓝色脉冲 | — | 纯展示不可点击 |

**弹窗 create-edit-task**：
- 标题：新建任务 / 编辑任务
- 字段：任务名称、任务类型（智能体/工作流）、Bot ID/Workflow ID、Cron 表达式（含预设快捷按钮）、消息模板/工作流参数
- 操作：取消、创建/保存

**弹窗 execution-logs**：
- 标题：执行日志
- 内容：日志卡片列表（状态图标 + 状态文字 + 时间 + 错误信息 + 响应摘要）
- 操作：关闭
