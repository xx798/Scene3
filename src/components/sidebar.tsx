'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, FileDown, Stethoscope, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '数据概览', icon: LayoutDashboard },
  { href: '/history', label: '诊断记录', icon: History },
  { href: '/reports', label: '报告下载', icon: FileDown },
  { href: '/settings', label: '系统设置', icon: Settings },
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
          <h1 className="text-sm font-semibold text-foreground">AI 诊断管理</h1>
          <p className="text-[11px] text-muted-foreground">图片智能分析平台</p>
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
      <div className="border-t border-border px-6 py-4">
        <p className="text-[11px] text-muted-foreground">v1.0.0</p>
      </div>
    </aside>
  );
}
