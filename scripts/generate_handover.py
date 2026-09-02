#!/usr/bin/env python3
"""生成交接文档"""

from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from datetime import datetime

doc = Document()

# 设置默认字体
style = doc.styles['Normal']
font = style.font
font.name = '微软雅黑'
font.size = Pt(10.5)
style.element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')

# 标题样式
for i in range(1, 4):
    hs = doc.styles[f'Heading {i}']
    hs.font.name = '微软雅黑'
    hs.element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
    hs.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Light Grid Accent 1'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Header
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9)
    # Data
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = table.rows[ri + 1].cells[ci]
            cell.text = str(val)
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)
    return table

# ===== 封面 =====
doc.add_paragraph()
doc.add_paragraph()
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('深燃-安全巡检智能体')
run.bold = True
run.font.size = Pt(28)
run.font.color.rgb = RGBColor(0x0E, 0xA5, 0xE9)

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run('系统交接文档')
run.bold = True
run.font.size = Pt(18)
run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

doc.add_paragraph()
info = doc.add_paragraph()
info.alignment = WD_ALIGN_PARAGRAPH.CENTER
info.add_run(f'文档版本：V1.0\n').font.size = Pt(11)
info.add_run(f'生成日期：{datetime.now().strftime("%Y-%m-%d")}\n').font.size = Pt(11)
info.add_run('项目名称：深燃集团AI智能体安全运营管理项目\n').font.size = Pt(11)
info.add_run('验收场景：场景三 - 地下管网高风险作业监控智能体').font.size = Pt(11)

doc.add_page_break()

# ===== 目录 =====
doc.add_heading('目录', level=1)
toc_items = [
    '一、项目概述',
    '二、系统架构',
    '三、技术栈',
    '四、数据库设计',
    '五、功能模块详解',
    '六、API 接口清单',
    '七、扣子平台集成',
    '八、部署说明',
    '九、运维指南',
    '十、已知问题与后续规划',
]
for item in toc_items:
    doc.add_paragraph(item, style='List Number')

doc.add_page_break()

# ===== 一、项目概述 =====
doc.add_heading('一、项目概述', level=1)

doc.add_heading('1.1 项目背景', level=2)
doc.add_paragraph(
    '本项目为深燃集团AI智能体安全运营管理项目场景三——"地下管网高风险作业监控智能体"。'
    '系统通过布控球摄像头自动获取施工现场图片，由AI智能体进行安全诊断分析，'
    '输出结构化诊断报告（含Excel记录和文字版），并通过网页管理后台进行数据展示、'
    '报告下载和定时任务管理。'
)

doc.add_heading('1.2 核心业务流程', level=2)
doc.add_paragraph('完整业务链路如下：')
flow_steps = [
    '用户在"系统设置"页选择需要运行的诊断工作流（如 Scene3_featur_2）和调度频率',
    '调度引擎按设定频率自动调用扣子工作流，工作流自动获取布控球视频截图并进行AI诊断',
    '诊断结果（结构化JSON）自动存入数据库 daily_diagnose_data 表',
    '每天 18:00 自动合并当日所有单次诊断记录，生成汇总 Excel 总报告',
    '用户可在"报告下载"页查看和下载历史每日报告',
    'Dashboard 实时展示今日诊断统计数据',
]
for i, step in enumerate(flow_steps, 1):
    doc.add_paragraph(f'{i}. {step}')

doc.add_heading('1.3 诊断输出格式', level=2)
doc.add_paragraph('每次诊断返回的 JSON 结构如下：')
doc.add_paragraph(
    '{\n'
    '  "camera_id": "摄像头编号",\n'
    '  "site_name_watermark": "水印识别的场地名称",\n'
    '  "camera_status": "正常/画面遮挡/画面黑屏/画面偏移/信号中断",\n'
    '  "camera_abnormal_desc": "设备异常详情",\n'
    '  "risk_items": [\n'
    '    {"item_name": "防护用品穿戴", "status": "正常/异常/无法识别", "risk_desc": "异常详情"},\n'
    '    {"item_name": "通用作业规范", ...},\n'
    '    {"item_name": "车辆防滑固定", ...},\n'
    '    {"item_name": "土方堆放安全", ...},\n'
    '    {"item_name": "逃生通道设置", ...},\n'
    '    {"item_name": "灭火器配备", ...},\n'
    '    {"item_name": "人员吸烟行为", ...},\n'
    '    {"item_name": "现场火焰明火", ...}\n'
    '  ],\n'
    '  "capture_time": "水印识别的图片时间",\n'
    '  "image_url": "对应图片URL",\n'
    '  "Excel_url": "对应Excel输出URL"\n'
    '}'
)

doc.add_page_break()

# ===== 二、系统架构 =====
doc.add_heading('二、系统架构', level=1)

doc.add_heading('2.1 整体架构图', level=2)
doc.add_paragraph(
    '┌─────────────────────────────────────────────────────────────┐\n'
    '│                    扣子平台 (Coze)                           │\n'
    '│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │\n'
    '│  │ 诊断工作流    │  │ Excel生成    │  │ 飞书告警     │      │\n'
    '│  │ Scene3_featur │  │ To_excel_3   │  │ (独立工作流)  │      │\n'
    '│  └──────┬───────┘  └──────────────┘  └──────────────┘      │\n'
    '└─────────┼───────────────────────────────────────────────────┘\n'
    '          │ API 调用\n'
    '          ▼\n'
    '┌─────────────────────────────────────────────────────────────┐\n'
    '│              网页应用 (Next.js 16)                           │\n'
    '│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │\n'
    '│  │ Dashboard │  │ 历史记录  │  │ 报告下载  │  │ 系统设置  │   │\n'
    '│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │\n'
    '│  ┌──────────────────────────────────────────────────────┐  │\n'
    '│  │ 调度引擎 (scheduler.ts) + 诊断解析 (diagnosis-processor) │  │\n'
    '│  └──────────────────────────────────────────────────────┘  │\n'
    '└─────────────────────────┬───────────────────────────────────┘\n'
    '                          │\n'
    '                          ▼\n'
    '┌─────────────────────────────────────────────────────────────┐\n'
    '│              Supabase (PostgreSQL)                          │\n'
    '│  daily_diagnose_data | daily_reports | scheduled_tasks      │\n'
    '└─────────────────────────────────────────────────────────────┘'
)

doc.add_heading('2.2 目录结构', level=2)
doc.add_paragraph(
    'src/\n'
    '├── app/\n'
    '│   ├── page.tsx              # Dashboard 数据概览\n'
    '│   ├── history/page.tsx      # 历史诊断列表\n'
    '│   ├── reports/page.tsx      # 报告下载专区\n'
    '│   ├── scheduled-tasks/      # 定时任务管理\n'
    '│   ├── api/                  # 后端 API 路由\n'
    '│   │   ├── dashboard/        # 今日统计\n'
    '│   │   ├── history/          # 诊断记录查询\n'
    '│   │   ├── reports/          # 报告管理 + Excel生成\n'
    '│   │   ├── scheduled-tasks/  # 定时任务 CRUD\n'
    '│   │   └── health/           # 健康检查\n'
    '│   └── layout.tsx            # 全局布局\n'
    '├── components/\n'
    '│   ├── sidebar.tsx           # 侧边栏导航\n'
    '│   └── ui/                   # shadcn/ui 组件库\n'
    '├── lib/\n'
    '│   ├── bot-caller.ts         # 扣子智能体/工作流调用\n'
    '│   ├── scheduler.ts          # 定时调度引擎\n'
    '│   ├── report-generator.ts   # Excel 报告生成器\n'
    '│   └── diagnosis-processor.ts # 诊断结果解析入库\n'
    '└── storage/database/\n'
    '    ├── supabase-client.ts    # Supabase 客户端\n'
    '    └── shared/schema.ts      # 数据表定义'
)

doc.add_page_break()

# ===== 三、技术栈 =====
doc.add_heading('三、技术栈', level=1)

add_table(doc,
    ['类别', '技术', '版本/说明'],
    [
        ['框架', 'Next.js', '16 (App Router)'],
        ['核心', 'React', '19'],
        ['语言', 'TypeScript', '5 (strict 模式)'],
        ['UI组件', 'shadcn/ui', '基于 Radix UI'],
        ['样式', 'Tailwind CSS', '4'],
        ['数据库', 'Supabase', 'PostgreSQL (云端托管)'],
        ['ORM', 'Drizzle ORM', '数据表定义与查询'],
        ['Excel生成', 'exceljs', '后端生成 Excel 报告'],
        ['定时调度', 'node-cron', '应用层 cron 调度'],
        ['包管理', 'pnpm', '唯一允许的包管理器'],
        ['AI平台', '扣子 (Coze)', '智能体 + 工作流'],
    ]
)

doc.add_page_break()

# ===== 四、数据库设计 =====
doc.add_heading('四、数据库设计', level=1)

doc.add_heading('4.1 daily_diagnose_data（诊断记录表）', level=2)
doc.add_paragraph('存储每次AI诊断的完整结果，是核心业务表。')
add_table(doc,
    ['字段', '类型', '说明'],
    [
        ['id', 'serial PK', '自增主键'],
        ['diagnose_time', 'timestamptz', '诊断执行时间'],
        ['camera_id', 'text', '摄像头编号（如 CAM-001）'],
        ['site_name_watermark', 'text', '水印识别的场地名称'],
        ['camera_status', 'varchar', '设备状态：正常/画面遮挡/画面黑屏/画面偏移/信号中断'],
        ['camera_abnormal_desc', 'text', '设备异常详情'],
        ['risk_items', 'jsonb', '8项风险检查明细数组'],
        ['capture_time', 'timestamptz', '水印识别的图片拍摄时间'],
        ['image_url', 'text', '现场图片URL'],
        ['excel_url', 'text', '单次诊断Excel链接'],
        ['status', 'varchar', '综合状态：normal/abnormal'],
        ['created_at', 'timestamptz', '创建时间'],
    ]
)

doc.add_paragraph()
doc.add_heading('4.2 daily_reports（每日汇总报告表）', level=2)
doc.add_paragraph('存储每日合并生成的总报告记录。')
add_table(doc,
    ['字段', '类型', '说明'],
    [
        ['id', 'serial PK', '自增主键'],
        ['report_date', 'varchar(10) UNIQUE', '报告日期 YYYY-MM-DD'],
        ['excel_url', 'text', '生成的 Excel 报告下载链接'],
        ['file_name', 'varchar', '文件名'],
        ['total_count', 'int', '诊断总次数'],
        ['abnormal_count', 'int', '异常次数'],
        ['normal_count', 'int', '正常次数'],
        ['created_at', 'timestamptz', '创建时间'],
        ['updated_at', 'timestamptz', '更新时间'],
    ]
)

doc.add_paragraph()
doc.add_heading('4.3 scheduled_tasks（定时任务配置表）', level=2)
add_table(doc,
    ['字段', '类型', '说明'],
    [
        ['id', 'serial PK', '自增主键'],
        ['name', 'varchar', '任务名称'],
        ['task_type', 'varchar', '任务类型：bot/workflow'],
        ['bot_id', 'varchar', '智能体ID（bot类型时）'],
        ['workflow_id', 'varchar', '工作流ID（workflow类型时）'],
        ['cron_expression', 'varchar', 'cron 表达式'],
        ['prompt_template', 'text', '智能体消息模板'],
        ['workflow_parameters', 'text', '工作流输入参数模板'],
        ['is_active', 'boolean', '是否启用'],
        ['last_run_at', 'timestamptz', '上次执行时间'],
    ]
)

doc.add_paragraph()
doc.add_heading('4.4 task_execution_logs（执行日志表）', level=2)
add_table(doc,
    ['字段', '类型', '说明'],
    [
        ['id', 'serial PK', '自增主键'],
        ['task_id', 'int FK', '关联任务ID'],
        ['status', 'varchar', 'running/success/failed'],
        ['prompt_sent', 'text', '发送的消息'],
        ['response_content', 'text', '返回内容'],
        ['error_message', 'text', '错误信息'],
        ['started_at', 'timestamptz', '开始时间'],
        ['completed_at', 'timestamptz', '完成时间'],
    ]
)

doc.add_page_break()

# ===== 五、功能模块详解 =====
doc.add_heading('五、功能模块详解', level=1)

doc.add_heading('5.1 数据概览（Dashboard）', level=2)
doc.add_paragraph('路径：/')
doc.add_paragraph('功能：')
items = [
    '展示今日诊断总数、异常条目数、正常条目数',
    '通过 Supabase Realtime 实时监听新诊断数据插入',
    '卡片式布局，异常用红色高亮，正常用绿色',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('5.2 历史诊断列表', level=2)
doc.add_paragraph('路径：/history')
doc.add_paragraph('功能：')
items = [
    '列表展示所有诊断记录：执行时间、摄像头编号、场地名称、设备状态、风险摘要',
    '支持按日期筛选当日记录',
    '每条记录可展开查看8项风险检查明细（正常/异常/无法识别）',
    '图片缩略图可点击跳转到原图',
    '实时监听新数据插入，自动刷新列表',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('5.3 报告下载专区', level=2)
doc.add_paragraph('路径：/reports')
doc.add_paragraph('功能：')
items = [
    '日期选择器，选定日期后点击"生成报告"按钮',
    '后端调用 report-generator.ts，读取当日所有诊断记录',
    '使用 exceljs 在内存中生成 Excel 文件（3个Sheet）',
    '生成的 Excel 包含：汇总概览、诊断明细、风险项明细',
    '近7天报告列表展示，每条记录附带下载按钮',
    '支持删除历史报告',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_paragraph()
doc.add_paragraph('Excel 报告格式说明：')
add_table(doc,
    ['Sheet', '内容', '说明'],
    [
        ['汇总概览', '报告日期、诊断总次数、正常/异常次数、生成时间', '快速概览当日统计'],
        ['诊断明细', '每次诊断的摘要：时间、摄像头、场地、设备状态、8项风险状态', '每次诊断占1行'],
        ['风险项明细', '每次诊断的8个检查项逐行展开，含状态和异常描述', '方便筛选统计'],
    ]
)

doc.add_heading('5.4 定时任务管理', level=2)
doc.add_paragraph('路径：/scheduled-tasks')
doc.add_paragraph('功能：')
items = [
    '创建定时任务：选择任务类型（智能体/工作流）、填写ID、设置cron表达式',
    '支持从工作流列表下拉选择（自动拉取扣子平台工作流列表）',
    '手动触发任务执行',
    '查看任务执行日志（状态、发送内容、返回结果、错误信息）',
    '启用/暂停/删除任务',
    '外部触发器接口（/api/scheduled-tasks/trigger-due），供 GitHub Actions 调用',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('5.5 调度引擎', level=2)
doc.add_paragraph('核心文件：src/lib/scheduler.ts')
items = [
    '基于 node-cron 实现，服务启动时自动初始化',
    '从 scheduled_tasks 表加载所有启用任务，注册 cron 定时执行',
    '任务执行后自动解析返回的诊断 JSON，存入 daily_diagnose_data 表',
    '内置每日 18:00 合并任务，自动调用 report-generator 生成当日总报告',
    '支持热重载：任务变更时自动重新加载调度',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_page_break()

# ===== 六、API 接口清单 =====
doc.add_heading('六、API 接口清单', level=1)

add_table(doc,
    ['路径', '方法', '说明', '参数'],
    [
        ['/api/dashboard', 'GET', '获取今日诊断统计', '无'],
        ['/api/history', 'GET', '按日期查询诊断记录', 'date=YYYY-MM-DD'],
        ['/api/reports', 'GET', '获取每日汇总报告列表', '无'],
        ['/api/reports/generate', 'POST', '生成指定日期Excel报告', 'body: {date: "YYYY-MM-DD"}'],
        ['/api/reports/download', 'GET', '下载报告文件', 'url=报告URL'],
        ['/api/scheduled-tasks', 'GET', '获取所有定时任务', '无'],
        ['/api/scheduled-tasks', 'POST', '创建定时任务', 'body: {name, task_type, bot_id/workflow_id, cron_expression}'],
        ['/api/scheduled-tasks/[id]', 'GET/PUT/DELETE', '单个任务查询/更新/删除', 'id: 任务ID'],
        ['/api/scheduled-tasks/[id]/trigger', 'POST', '手动触发任务', 'id: 任务ID'],
        ['/api/scheduled-tasks/[id]/logs', 'GET', '获取执行日志', 'id, limit'],
        ['/api/scheduled-tasks/trigger-due', 'POST', '外部定时触发器', '?window=5'],
        ['/api/health', 'GET', '健康检查', '无'],
    ]
)

doc.add_page_break()

# ===== 七、扣子平台集成 =====
doc.add_heading('七、扣子平台集成', level=1)

doc.add_heading('7.1 诊断工作流', level=2)
add_table(doc,
    ['工作流名称', 'ID', '说明'],
    [
        ['Scene3_featur_2', '7661943074336112674', '地下管网高风险作业视频监控诊断（最新版，推荐使用）'],
        ['Scene3_featur_1', '7658602262420701236', '同上，旧版'],
        ['scene_one', '7660229041123246086', '第三方施工工地巡查照片分析'],
    ]
)

doc.add_paragraph()
doc.add_heading('7.2 Excel 生成工作流', level=2)
add_table(doc,
    ['工作流名称', 'ID', '说明'],
    [
        ['To_excel_3', '7660403800638029824', '诊断JSON转Excel（最新版）'],
        ['To_excel_2', '7660381734656409627', '同上'],
        ['To_excel_1', '7660199324303933446', '同上'],
    ]
)

doc.add_paragraph()
doc.add_heading('7.3 调用方式', level=2)
doc.add_paragraph(
    '网页后端通过扣子 OpenAPI 调用工作流，核心逻辑在 src/lib/bot-caller.ts：\n'
    '- 使用 COZE_WORKLOAD_API_TOKEN 进行鉴权\n'
    '- 调用 POST /v1/workflows/run 执行工作流\n'
    '- 支持同步/异步两种模式\n'
    '- 返回结果自动解析为诊断JSON并入库'
)

doc.add_heading('7.4 环境变量', level=2)
add_table(doc,
    ['变量名', '说明', '必填'],
    [
        ['COZE_WORKLOAD_API_TOKEN', '扣子平台 API Token (PAT/SAT)', '是'],
        ['COZE_PROJECT_SPACE_ID', '工作空间 ID', '是'],
        ['COZE_API_BASE_URL', 'API 基础地址', '否（默认 https://api.coze.cn）'],
        ['COZE_SUPABASE_URL', 'Supabase 数据库地址', '是（平台自动注入）'],
        ['COZE_SUPABASE_SERVICE_ROLE_KEY', 'Supabase 管理员密钥', '是（平台自动注入）'],
    ]
)

doc.add_page_break()

# ===== 八、部署说明 =====
doc.add_heading('八、部署说明', level=1)

doc.add_heading('8.1 当前部署方式', level=2)
doc.add_paragraph(
    '项目部署在 Coze 平台沙箱环境中，通过公网域名对外提供访问。\n'
    '数据库使用平台托管的 Supabase (PostgreSQL)。\n'
    '构建命令：pnpm run build\n'
    '启动命令：pnpm run start\n'
    '端口：通过 DEPLOY_RUN_PORT 环境变量指定（默认 5000）'
)

doc.add_heading('8.2 生产部署注意事项', level=2)
items = [
    '最终生产部署方案需深燃方、技术方及平台方进一步确认',
    '需确认服务器环境、网络策略和迁移安排',
    '第三方视频平台网络质量、布控球在线状态、SMS流媒体服务稳定性属于外部运行条件',
    '客户侧防火墙策略可能影响视频流获取',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('8.3 外部定时触发', level=2)
doc.add_paragraph(
    '由于 FaaS 平台无人访问时实例可能休眠，定时任务可能不生效。\n'
    '解决方案：通过 GitHub Actions 每分钟调用 /api/scheduled-tasks/trigger-due 接口，\n'
    '应用层判断到期任务并执行，支持 5 分钟补偿窗口。\n\n'
    '需配置的 GitHub Secrets：\n'
    '- APP_DOMAIN：应用域名\n'
    '- CRON_TRIGGER_TOKEN：（可选）鉴权令牌'
)

doc.add_page_break()

# ===== 九、运维指南 =====
doc.add_heading('九、运维指南', level=1)

doc.add_heading('9.1 数据库管理', level=2)
doc.add_paragraph(
    '数据库为 Supabase (PostgreSQL)，可通过以下方式管理：\n'
    '1. 在 Coze 平台集成管理页面查看数据库配置\n'
    '2. 使用 Supabase Dashboard 可视化管理数据表\n'
    '3. 通过 SQL 直接操作（在开发会话中执行）'
)

doc.add_heading('9.2 健康检查', level=2)
doc.add_paragraph('接口：GET /api/health\n返回 200 表示服务正常运行。')

doc.add_heading('9.3 日志查看', level=2)
doc.add_paragraph(
    '应用日志位于 /app/work/logs/bypass/ 目录：\n'
    '- app.log：主流程日志\n'
    '- console.log：控制台输出\n'
    '- dev.log：开发调试日志'
)

doc.add_heading('9.4 常见问题', level=2)
add_table(doc,
    ['问题', '原因', '解决方案'],
    [
        ['定时任务不执行', 'FaaS 实例休眠', '配置 GitHub Actions 心跳保活'],
        ['视频截图获取失败', '布控球离线/网络问题', '检查设备在线状态和网络连通性'],
        ['报告生成失败', '当日无诊断数据', '确认诊断任务已正常执行'],
        ['页面加载缓慢', '冷启动', '配置心跳保活，保持实例活跃'],
    ]
)

doc.add_page_break()

# ===== 十、已知问题与后续规划 =====
doc.add_heading('十、已知问题与后续规划', level=1)

doc.add_heading('10.1 已知问题', level=2)
items = [
    '视频画面获取受第三方布控球平台、SMS流媒体服务、网络带宽影响，可能偶发失败',
    'AI 识别准确率与现场光照、拍摄角度、视频清晰度相关，需持续调优',
    'FaaS 平台冷启动可能导致定时任务延迟，已通过心跳保活缓解',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('10.2 后续规划', level=2)
items = [
    '分角色/分区域专属工作流：根据试点推进，分别开发龙岗、南山专属诊断工作流',
    '连续帧复核与告警去重：针对吸烟、火焰等情况增加连续帧复核',
    '灭火器专项核验：增加灭火器在位状态周期核验',
    '全面推广至其他区域：需按区域新增布控球设备配置、专属诊断工作流、告警群',
    '生产环境迁移：最终服务器环境、网络策略和迁移安排需多方确认',
    '系统操作培训：全面推广后需进行操作培训和技术支持',
]
for item in items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_page_break()

# ===== 附录 =====
doc.add_heading('附录：交付验收依据', level=1)
items = [
    '《深燃集团安全管理部门AI智能体应用需求调研报告》V1.0（2026-06-05）',
    '《深燃集团项目工作留痕记录表》（2026-06-22至2026-07-28）',
    '《深燃集团项目工作留痕记录表》（2026-07-20至2026-08-20）',
    '《深燃集团场景三新增需求及新增工作量汇总》',
    '场景三龙岗/南山试点、飞书告警、网页应用、实时视频流及第三方平台联调记录',
    '《深燃集团场景三功能交付验收确认单》（2026-09-02）',
]
for i, item in enumerate(items, 1):
    doc.add_paragraph(f'{i}. {item}')

# 保存
output_path = '/workspace/projects/public/深燃-安全巡检智能体-系统交接文档.docx'
doc.save(output_path)
print(f'Document saved to: {output_path}')
