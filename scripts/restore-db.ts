import { readFile } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import pg from 'pg';

loadEnvConfig(process.cwd(), true);
const tables = ['daily_diagnose_data', 'daily_reports', 'health_check', 'scheduled_tasks', 'task_execution_logs', 'users'];

// The export contains multiline quoted JSON/text; never split on newlines or blindly execute DROP.
export function extractInserts(sql: string): { table: string; sql: string }[] {
  const result: { table: string; sql: string }[] = [];
  let statement = '', quoted = false, comment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (comment) { if (ch === '\n') { comment = false; statement += '\n'; } continue; }
    if (!quoted && ch === '-' && sql[i + 1] === '-') { comment = true; i++; continue; }
    statement += ch;
    if (ch === "'") {
      if (quoted && sql[i + 1] === "'") { statement += sql[++i]; continue; }
      quoted = !quoted;
    }
    if (!quoted && ch === ';') {
      const trimmed = statement.trim();
      if (/^INSERT\b/i.test(trimmed)) {
        const match = /^INSERT INTO public\.([a-z_]+)\s*\([^)]*\)\s*VALUES\s*\(/i.exec(trimmed);
        if (!match || !tables.includes(match[1])) throw new Error('备份包含未知的 INSERT 表或格式');
        result.push({ table: match[1], sql: trimmed });
      }
      statement = '';
    }
  }
  if (quoted || statement.trim()) throw new Error('备份不完整或字符串未闭合');
  return result;
}

async function main() {
  const file = process.argv[2];
  if (!file || !process.env.DATABASE_URL) throw new Error('用法: pnpm db:restore <SQL路径>，并配置 DATABASE_URL');
  const inserts = extractInserts(await readFile(file, 'utf8'));
  if (!inserts.length) throw new Error('没有找到数据');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL standard_conforming_strings = on');
    await client.query('LOCK TABLE ' + tables.map(t => `public.${t}`).join(', ') + ' IN ACCESS EXCLUSIVE MODE');
    for (const table of tables) {
      const r = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
      if (r.rows[0].count) throw new Error(`${table} 已有数据，恢复已取消；请使用新建的空数据库`);
    }
    for (let i = 0; i < inserts.length; i++) {
      try { await client.query(inserts[i].sql); }
      catch { throw new Error(`第 ${i + 1} 条 ${inserts[i].table} 数据导入失败，已回滚`); }
    }
    for (const table of tables) {
      const r = await client.query(`SELECT count(*)::int AS count, max(id) AS max_id FROM public.${table}`);
      const { count, max_id: maxId } = r.rows[0];
      const expected = inserts.filter(row => row.table === table).length;
      if (count !== expected) throw new Error(`${table} 数量不匹配`);
      const seq = await client.query('SELECT pg_get_serial_sequence($1, $2) AS name', [`public.${table}`, 'id']);
      if (!seq.rows[0].name) throw new Error(`${table} 序列未绑定`);
      // ALTER SEQUENCE RESTART is transactional, unlike setval().
      await client.query(`ALTER SEQUENCE public.${table}_id_seq RESTART WITH ${Number(maxId ?? 0) + 1}`);
      console.log(`${table}: ${count} 条，下一 ID ${Number(maxId ?? 0) + 1}`);
    }
    await client.query('COMMIT');
    console.log('恢复完成。原备份未修改，原账号密码保留。');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/restore-db.ts')) {
  main().catch(error => { console.error(error instanceof Error ? error.message : '恢复失败'); process.exitCode = 1; });
}
