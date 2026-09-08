# Windows 本地迁移说明

## 当前范围

按用户要求，先完成 Windows 本地应用环境，暂停 Linux/WSL 数据库容器方案。本阶段不导入数据库、不修改原账号密码、不调用真实扣子任务。Dockerfile、compose.yaml 和 Supabase 迁移文件只是后续部署准备，不代表数据库已经运行。

## 本地启动

在项目目录打开 PowerShell，使用 Node.js 22.13.0 或更高版本、pnpm 11：

```powershell
pnpm install --frozen-lockfile
pnpm local:prepare
pnpm dev
```

`local:prepare` 仅在 `.env.local` 不存在时生成随机登录签名密钥和本地配置，不覆盖已有配置，也不启动数据库。已有 `.env.local` 时跳过这一步。

页面地址：http://127.0.0.1:5000 。缺少数据库连接时，只能打开登录入口，不能完成登录和业务操作；`/api/health` 返回 503 是真实的“数据库未就绪”，不是迁移完成。

## 后续接入真实数据

需要在 `.env.local` 填写 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL`。当前数据访问代码依赖 Supabase REST API，单独安装 PostgreSQL 并填写连接串并不能直接运行全部业务；如选纯 PostgreSQL，需要另行改造数据访问层。

确认数据库方案后，在空库应用 `supabase/migrations/20260907151047_initial_schema.sql`，再运行：

```powershell
pnpm db:restore "C:\Users\蔡建雄\Downloads\db-backup-20260907_150904.sql"
```

恢复脚本只读取六张业务表的 INSERT，不执行备份中的 DROP/CREATE；在事务中检查空表、恢复记录、核对数量并修复序列。非空表会拒绝导入。备份预期共 319 条：诊断 99、报告 2、健康检查 1、定时任务 3、执行日志 211、用户 3。账号密码保留原 bcrypt 哈希，不能从备份读出明文。

如生产环境导出为 Excel，先启动 Supabase 后执行：

```powershell
pnpm db:import-production "C:\path\to\prod-export.xlsx"
```

该命令仅替换 Excel 内的四张表：`daily_diagnose_data`、`scheduled_tasks`、`task_execution_logs`、`daily_reports`。它会先校验全部工作表、字段、JSON 和任务日志关联，再在单一事务中替换数据并修复序列；失败会回滚。`users` 和 `health_check` 不会被修改。

填写 `COZE_API_TOKEN` 后还需验证原 bot/workflow ID 的访问权限。确认真实任务执行成功后再将 `SCHEDULER_ENABLED` 改为 `true` 并重启。当前保持关闭，防止历史任务自动调用云端。

## 已做的兼容调整

- 跨平台启动脚本、显式加载环境变量，移除扣子运行平台专用依赖。
- 服务端使用 Supabase service-role key；浏览器不再拿数据库配置直接订阅，而通过鉴权接口轮询。
- 独立的 APP_JWT_SECRET；修改密码在服务端验证旧密码，并使旧令牌失效。
- 报告保存到 data/reports，通过鉴权下载；统一上海时区的日期查询。
- 修复 cron 到期判断，单进程共享调度状态与执行锁。
- 提供无业务数据的建表迁移、受保护的数据恢复脚本和单元测试。

生产构建：`pnpm build`，启动：`pnpm start`。调度仅支持单应用实例；暂不应多副本运行。

## 安全与尚待验证

`.env.local`、原始 SQL 备份和 data 目录均不提交 Git。service-role key 只能放服务端。原备份中的图片和附件 URL 不等于文件备份，其有效性和下载保留尚待验证。

数据库导入、真实登录、任务 CRUD、报告下载和扣子真实调用需要数据库连接后完成端到端验收。代码检查或页面启动不能替代这些验收。
