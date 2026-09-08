import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

if (existsSync('.env.local')) throw new Error('.env.local 已存在，未覆盖。请按 .env.example 手工更新。');
const cli = path.join(process.cwd(), 'node_modules/supabase/dist/supabase.js');
const prepareOnly = process.argv.includes('--prepare');
const status = prepareOnly
  ? { API_URL: '', SERVICE_ROLE_KEY: '', DB_URL: '' }
  : JSON.parse(execFileSync(process.execPath, [cli, 'status', '-o', 'json'], { encoding: 'utf8', timeout: 30000 }));
if (!prepareOnly && (!status.API_URL || !status.SERVICE_ROLE_KEY || !status.DB_URL)) throw new Error('本地 Supabase 未就绪');
const env = {
  PORT: '5000', HOSTNAME: '127.0.0.1', TZ: 'Asia/Shanghai',
  APP_JWT_SECRET: randomBytes(48).toString('hex'),
  SUPABASE_URL: status.API_URL, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  DATABASE_URL: status.DB_URL,
  COZE_API_BASE_URL: 'https://api.coze.cn', COZE_API_TOKEN: '',
  CRON_TRIGGER_TOKEN: randomBytes(32).toString('hex'),
  REPORTS_DIR: './data/reports', SCHEDULER_ENABLED: 'false',
};
writeFileSync('.env.local', Object.entries(env).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log(prepareOnly
  ? '已生成本地启动配置（未连接数据库）。请后续填写 Supabase 连接信息和 COZE_API_TOKEN；调度保持关闭。'
  : '已生成 .env.local。密钥未输出；请填写 COZE_API_TOKEN，验证后再启用调度。');
