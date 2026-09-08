import path from 'node:path';
export function getReportsDir(): string {
  return path.resolve(process.env.REPORTS_DIR || path.join(process.cwd(), 'data', 'reports'));
}
export function getReportPath(name: string): string {
  if (!name || name !== path.basename(name) || /[\\/]/.test(name) || !name.endsWith('.xlsx')) {
    throw new Error('无效的报告文件名');
  }
  return path.join(getReportsDir(), name);
}
