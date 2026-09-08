export function shanghaiDate(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function shanghaiDayRange(date: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('无效日期');
  const start = new Date(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(start.getTime()) || shanghaiDate(start) !== date) throw new Error('无效日期');
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}
