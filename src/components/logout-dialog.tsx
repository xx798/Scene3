'use client';

import { useState } from 'react';
import { LogOut, X, AlertTriangle } from 'lucide-react';
import { useAuth } from './auth-provider';
import { authFetch } from '@/lib/auth-fetch';

export function LogoutDialog() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 即使接口失败也执行本地登出
    } finally {
      setLoading(false);
      logout();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-50 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => !loading && setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0F172A]">确认退出</h3>
                <p className="mt-1 text-sm text-[#64748B]">退出后需要重新登录才能使用系统</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-[#0F172A] transition-colors hover:bg-gray-50"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
              >
                {loading ? '退出中...' : '确认退出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
