# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── api/            # 后端 API 路由
│   │   │   ├── dashboard/  # 数据概览接口 (GET)
│   │   │   ├── health/     # 健康检查接口 (GET)
│   │   │   ├── history/    # 诊断记录接口 (GET?date=)
│   │   │   ├── reports/    # 报告接口 (GET, POST generate)
│   │   │   └── scheduled-tasks/  # 定时任务管理接口 (CRUD + trigger + logs + trigger-due)
│   │   ├── history/        # 历史诊断列表页
│   │   ├── reports/        # 报告下载专区页
│   │   └── scheduled-tasks/  # 定时任务管理页
│   ├── components/         # 组件
│   │   ├── sidebar.tsx     # 侧边栏导航
│   │   └── ui/             # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   ├── utils.ts        # 通用工具函数 (cn)
│   │   ├── bot-caller.ts   # 扣子智能体/工作流调用逻辑
│   │   ├── scheduler.ts    # 定时任务调度引擎 (cron) + 诊断结果解析入库
│   │   └── report-generator.ts  # 每日报告合并生成器 (exceljs)
│   ├── storage/database/   # 数据库
│   │   ├── supabase-client.ts  # Supabase 客户端
│   │   └── shared/schema.ts    # 数据表定义
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 数据表

- `daily_diagnose_data`: AI 诊断记录表
  - `id` (serial PK)
  - `diagnose_time` (timestamptz) - 诊断执行时间
  - `camera_id` (text) - 摄像头编号
  - `site_name_watermark` (text) - 水印识别的场地名称
  - `camera_status` (varchar) - 设备状态：正常/画面遮挡/画面黑屏/画面偏移/信号中断
  - `camera_abnormal_desc` (text) - 设备异常详情
  - `risk_items` (jsonb) - 风险检查项数组，每项含 item_name/status/risk_desc
  - `capture_time` (timestamptz) - 水印识别的图片拍摄时间
  - `image_url` (text) - 现场图片URL
  - `excel_url` (text) - 生成的Excel报告下载链接
  - `status` (varchar: normal/abnormal) - 综合状态
  - `created_at` (timestamptz)
- `scheduled_tasks`: 定时任务配置表
  - `id` (serial PK), `name` (varchar), `task_type` (varchar: bot/workflow)
  - `bot_id` (varchar, nullable) - 智能体任务时填写
  - `workflow_id` (varchar, nullable) - 工作流任务时填写
  - `cron_expression` (varchar)
  - `prompt_template` (text) - 智能体消息模板，支持 `{{now}}`/`{{date}}`/`{{timestamp}}` 变量
  - `workflow_parameters` (text) - 工作流输入参数 JSON 模板，支持同样变量
  - `is_active` (boolean), `last_run_at` (timestamptz), `created_at`, `updated_at`
- `task_execution_logs`: 任务执行日志表
  - `id` (serial PK), `task_id` (int FK), `status` (varchar: running/success/failed)
  - `prompt_sent` (text), `response_content` (text), `error_message` (text)
  - `started_at` (timestamptz), `completed_at` (timestamptz)
- `daily_reports`: 每日汇总报告表
  - `id` (serial PK), `report_date` (varchar(10) UNIQUE) - 报告日期 YYYY-MM-DD
  - `excel_url` (text) - 生成的 Excel 报告下载链接
  - `file_name` (varchar) - 文件名
  - `total_count` (int) - 诊断总次数
  - `abnormal_count` (int) - 异常次数
  - `normal_count` (int) - 正常次数
  - `created_at` (timestamptz), `updated_at` (timestamptz)

## API 接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/dashboard` | GET | 获取今日统计（总数/异常/正常） |
| `/api/history?date=YYYY-MM-DD` | GET | 按日期查询诊断记录 |
| `/api/reports` | GET | 获取每日汇总报告列表 |
| `/api/reports/generate` | POST | 后端生成指定日期的 Excel 汇总报告 |
| `/api/scheduled-tasks` | GET | 获取所有定时任务 |
| `/api/scheduled-tasks` | POST | 创建定时任务 (body: name, task_type, bot_id/workflow_id, cron_expression, prompt_template) |
| `/api/scheduled-tasks/[id]` | GET/PUT/DELETE | 单个任务查询/更新/删除 |
| `/api/scheduled-tasks/[id]/trigger` | POST | 手动触发一次任务 |
| `/api/scheduled-tasks/[id]/logs?limit=N` | GET | 获取任务执行日志 |
| `/api/scheduled-tasks/trigger-due` | POST | 外部定时触发器入口，检查并执行到期任务（支持 `?window=5` 补偿窗口） |
| `/api/health` | GET | 健康检查接口，供心跳保活/探活使用 |

## 业务流程

1. **定时诊断**：用户在"定时任务管理"页创建任务，配置智能体/工作流 ID 和 cron 表达式。调度引擎按 cron 定时调用扣子 API，解析返回的诊断 JSON 存入 `daily_diagnose_data`
2. **报告下载**：用户在"报告下载"页查看历史报告并下载，也可手动选择日期生成报告
3. **数据概览**：Dashboard 实时展示今日诊断统计
4. **外部定时触发**：通过 GitHub Actions 每分钟调用 `/api/scheduled-tasks/trigger-due`，应用层判断到期任务并执行，解决 FaaS 冷休眠导致定时任务不生效的问题

## 外部定时触发配置

项目通过 GitHub Actions 实现外部定时触发，解决 FaaS 平台无人访问时实例休眠导致定时任务丢失的问题。

### 工作流程
- `.github/workflows/scheduled-tasks-trigger.yml`：每分钟调用 `/api/scheduled-tasks/trigger-due`
- 应用层读取 `scheduled_tasks` 表，根据 cron 表达式和 `last_run_at` 判断哪些任务到期
- 支持 5 分钟补偿窗口，冷启动延迟不会导致任务丢失

### 需要配置的 GitHub Secrets
- `APP_DOMAIN`：应用域名（如 `example.dev.coze.site`）
- `CRON_TRIGGER_TOKEN`：（可选）鉴权令牌，对应服务端环境变量 `CRON_TRIGGER_TOKEN`

### 环境变量
- `CRON_TRIGGER_TOKEN`：（可选）外部触发器的鉴权令牌，配置后请求需携带 `Authorization: Bearer <token>`

## 诊断智能体

- 诊断智能体："深燃智能场景识别应用"（用户自行创建）
- 输出格式：包含 camera_id、site_name_watermark、camera_status、risk_items（8项检查）、capture_time、image_url、Excel_url 的 JSON

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**
