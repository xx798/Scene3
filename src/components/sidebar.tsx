'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, FileDown, Clock, Users, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from './auth-provider';
import { LogoutDialog } from './logout-dialog';

const navItems = [
  { href: '/', label: '数据概览', icon: LayoutDashboard },
  { href: '/history', label: '诊断记录', icon: History },
  { href: '/reports', label: '报告下载', icon: FileDown },
];

const adminNavItems = [
  { href: '/scheduled-tasks', label: '定时任务', icon: Clock },
];

const managementNavItems = [
  { href: '/admin/users', label: '用户管理', icon: Users },
];

function getRoleLabel(role: string): string {
  switch (role) {
    case 'super_admin': return '超级管理员';
    case 'admin': return '管理员';
    default: return '员工';
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500">
          <span className="text-sm font-bold text-white">巡</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground truncate max-w-[140px]">巡检后台中心</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-xs font-medium text-[#64748B] uppercase tracking-wider">管理</span>
            </div>
            {adminNavItems.map((item) => {
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
          </>
        )}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-xs font-medium text-[#64748B] uppercase tracking-wider">系统</span>
            </div>
            {managementNavItems.map((item) => {
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
          </>
        )}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100">
            <User className="h-3.5 w-3.5 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A] truncate">{user?.name}</p>
            <p className="text-xs text-[#64748B] truncate">
              {user ? getRoleLabel(user.role) : ''}
            </p>
          </div>
        </div>
        <LogoutDialog />
      </div>
    </aside>
  );
}
