'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, FileDown, Stethoscope, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '数据概览', icon: LayoutDashboard },
  { href: '/history', label: '诊断记录', icon: History },
  { href: '/reports', label: '报告下载', icon: FileDown },
  { href: '/scheduled-tasks', label: '定时任务', icon: Clock },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500">
          <Stethoscope className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">深燃-安全巡检智能体</h1>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sky-50 text-sky-600'
                  : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
