import { CronTime } from 'cron';

export function isCronDueInWindow(expression: string, lastRunAt: string | null, windowMinutes = 5, now = new Date()): boolean {
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0 || windowMinutes > 60) return false;
  try {
    const windowStart = now.getTime() - windowMinutes * 60000;
    const lastRun = lastRunAt ? new Date(lastRunAt).getTime() : windowStart - 1;
    if (!Number.isFinite(lastRun) || lastRun >= now.getTime()) return false;
    const cron = new CronTime(expression, 'Asia/Shanghai');
    const next = cron.getNextDateFrom(new Date(Math.max(windowStart - 1, lastRun)), 'Asia/Shanghai').toMillis();
    return next <= now.getTime();
  } catch { return false; }
}
