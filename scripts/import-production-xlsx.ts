import { loadEnvConfig } from '@next/env';
import ExcelJS from 'exceljs';
import pg from 'pg';

loadEnvConfig(process.cwd(), true);

type TableName = 'daily_diagnose_data' | 'scheduled_tasks' | 'task_execution_logs' | 'daily_reports';

interface TableDefinition {
  name: TableName;
  columns: string[];
  requiredColumns: string[];
}

const tables: TableDefinition[] = [
  {
    name: 'daily_diagnose_data',
    columns: ['id', 'diagnose_time', 'status', 'created_at', 'camera_id', 'site_name_watermark', 'camera_status', 'camera_abnormal_desc', 'risk_items', 'capture_time', 'image_url'],
    requiredColumns: ['id', 'diagnose_time', 'status', 'created_at'],
  },
  {
    name: 'scheduled_tasks',
    columns: ['id', 'name', 'task_type', 'bot_id', 'workflow_id', 'cron_expression', 'prompt_template', 'workflow_parameters', 'is_active', 'last_run_at', 'next_run_at', 'created_at', 'updated_at'],
    requiredColumns: ['id', 'name', 'cron_expression', 'is_active', 'created_at', 'updated_at'],
  },
  {
    name: 'task_execution_logs',
    columns: ['id', 'task_id', 'status', 'prompt_sent', 'response_content', 'error_message', 'started_at', 'completed_at'],
    requiredColumns: ['id', 'task_id', 'status', 'started_at'],
  },
  {
    name: 'daily_reports',
    columns: ['id', 'report_date', 'excel_url', 'file_name', 'total_count', 'abnormal_count', 'normal_count', 'created_at', 'updated_at'],
    requiredColumns: ['id', 'report_date', 'created_at', 'updated_at'],
  },
];

type RowValues = Record<string, string | number | boolean | Date | null>;

const nullDefaults: Partial<Record<TableName, Record<string, string | number | boolean>>> = {
  daily_diagnose_data: { status: 'normal' },
  scheduled_tasks: { task_type: 'bot', prompt_template: '', workflow_parameters: '', is_active: true },
  task_execution_logs: { status: 'running' },
  daily_reports: { excel_url: '', total_count: 0, abnormal_count: 0, normal_count: 0 },
};

function toScalar(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text;
  throw new Error('Excel 包含不支持的单元格类型');
}

function getSheetRows(workbook: ExcelJS.Workbook, definition: TableDefinition): RowValues[] {
  const worksheet = workbook.getWorksheet(definition.name);
  if (!worksheet) throw new Error(`缺少工作表：${definition.name}`);

  const headers = Array.from(
    { length: worksheet.columnCount },
    (_, index) => worksheet.getCell(1, index + 1).text.trim(),
  );
  const missing = definition.columns.filter(column => !headers.includes(column));
  const extra = headers.filter(column => !definition.columns.includes(column));
  if (missing.length || extra.length) {
    throw new Error(`${definition.name} 字段不匹配；缺少：${missing.join(', ') || '无'}；多出：${extra.join(', ') || '无'}`);
  }

  const columnIndexes = new Map<string, number>(headers.map((header, index) => [header, index + 1]));
  const rows: RowValues[] = [];
  const ids = new Set<number>();
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || headers.every((_, index) => {
      const value = row.getCell(index + 1).value;
      return value === null || value === undefined || value === '';
    })) return;
    const result: RowValues = {};
    for (const column of definition.columns) {
      const index = columnIndexes.get(column);
      if (!index) throw new Error(`${definition.name} 缺少字段：${column}`);
      result[column] = toScalar(row.getCell(index).value);
    }
    for (const [column, value] of Object.entries(nullDefaults[definition.name] ?? {})) {
      if (result[column] === null) result[column] = value;
    }
    for (const column of definition.requiredColumns) {
      if (result[column] === null) throw new Error(`${definition.name} 第 ${rowNumber} 行缺少必填字段：${column}`);
    }
    const recordId = result.id;
    if (typeof recordId !== 'number' || !Number.isInteger(recordId) || recordId <= 0 || ids.has(recordId)) {
      throw new Error(`${definition.name} 第 ${rowNumber} 行的 id 无效或重复`);
    }
    ids.add(recordId);
    if (definition.name === 'daily_diagnose_data' && result.risk_items !== null) {
      if (typeof result.risk_items !== 'string') throw new Error(`${definition.name} 第 ${rowNumber} 行 risk_items 格式无效`);
      try { JSON.parse(result.risk_items); }
      catch { throw new Error(`${definition.name} 第 ${rowNumber} 行 risk_items 不是合法 JSON`); }
    }
    rows.push(result);
  });
  if (!rows.length) throw new Error(`${definition.name} 没有可导入的数据`);
  return rows;
}

function validateRelationships(rowsByTable: Map<TableName, RowValues[]>) {
  const taskIds = new Set<number>();
  for (const task of rowsByTable.get('scheduled_tasks') ?? []) {
    if (typeof task.id !== 'number') throw new Error('scheduled_tasks 包含无效 id');
    taskIds.add(task.id);
  }
  const orphan = (rowsByTable.get('task_execution_logs') ?? []).find(log => {
    return typeof log.task_id !== 'number' || !taskIds.has(log.task_id);
  });
  if (orphan) throw new Error(`task_execution_logs 存在未找到的 task_id：${String(orphan.task_id)}`);
}

async function main() {
  const file = process.argv[2];
  if (!file || !process.env.DATABASE_URL) {
    throw new Error('用法: pnpm db:import-production <Excel路径>，并配置 DATABASE_URL');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const rowsByTable = new Map<TableName, RowValues[]>(tables.map(definition => [definition.name, getSheetRows(workbook, definition)]));
  validateRelationships(rowsByTable);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE public.task_execution_logs, public.scheduled_tasks, public.daily_reports, public.daily_diagnose_data IN ACCESS EXCLUSIVE MODE');
    await client.query('TRUNCATE TABLE public.task_execution_logs, public.scheduled_tasks, public.daily_reports, public.daily_diagnose_data RESTART IDENTITY');

    for (const definition of tables) {
      const rows = rowsByTable.get(definition.name);
      if (!rows) throw new Error(`${definition.name} 数据缺失`);
      const placeholders = definition.columns.map((_, index) => `$${index + 1}`).join(', ');
      const sql = `INSERT INTO public.${definition.name} (${definition.columns.join(', ')}) VALUES (${placeholders})`;
      for (const row of rows) {
        await client.query(sql, definition.columns.map(column => row[column]));
      }
      const count = await client.query(`SELECT count(*)::int AS count, max(id)::int AS max_id FROM public.${definition.name}`);
      if (count.rows[0].count !== rows.length) throw new Error(`${definition.name} 导入数量不匹配`);
      await client.query(`ALTER SEQUENCE public.${definition.name}_id_seq RESTART WITH ${count.rows[0].max_id + 1}`);
      console.log(`${definition.name}: ${count.rows[0].count} 条，下一 ID ${count.rows[0].max_id + 1}`);
    }
    await client.query('COMMIT');
    console.log('生产 Excel 导入完成。用户和健康检查表未修改。');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/import-production-xlsx.ts')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : '导入失败');
    process.exitCode = 1;
  });
}
