'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, AlertCircle, Search, ShieldCheck, ShieldX, UserCheck, UserX, Crown } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/components/auth-provider';

interface UserItem {
  id: number;
  username: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

type ModalMode = 'create' | 'edit' | null;

function getRoleLabel(role: string): string {
  switch (role) {
    case 'super_admin': return '超级管理员';
    case 'admin': return '管理员';
    default: return '员工';
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'super_admin': return <Crown className="h-3 w-3" />;
    case 'admin': return <ShieldCheck className="h-3 w-3" />;
    default: return <ShieldX className="h-3 w-3" />;
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'super_admin': return 'bg-amber-50 text-amber-600';
    case 'admin': return 'bg-sky-50 text-sky-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'employee' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch { /* handled by authFetch */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  // 检查当前用户是否可以操作目标用户
  const canOperate = (target: UserItem): boolean => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;
    // admin 只能操作 employee
    return target.role === 'employee';
  };

  // 检查当前用户是否可以删除目标用户
  const canDelete = (target: UserItem): boolean => {
    if (!currentUser) return false;
    if (target.id === currentUser.userId) return false; // 不能删除自己
    if (target.role === 'super_admin') return false; // 不能删除超级管理员
    return canOperate(target);
  };

  const openCreate = () => {
    setForm({ username: '', password: '', name: '', role: 'employee' });
    setFormError('');
    setEditingUser(null);
    setModalMode('create');
  };

  const openEdit = (u: UserItem) => {
    setForm({ username: u.username, password: '', name: u.name, role: u.role });
    setFormError('');
    setEditingUser(u);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!form.username.trim() || !form.name.trim()) {
      setFormError('请填写账号和姓名');
      return;
    }
    if (modalMode === 'create' && !form.password) {
      setFormError('请设置密码');
      return;
    }
    if (form.password && form.password.length < 6) {
      setFormError('密码至少 6 位');
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        const res = await authFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || '创建失败'); return; }
      } else if (modalMode === 'edit' && editingUser) {
        const updates: Record<string, string> = { name: form.name.trim(), role: form.role };
        if (form.password) updates.password = form.password;
        const res = await authFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || '更新失败'); return; }
      }
      closeModal();
      fetchUsers();
    } catch {
      setFormError('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await authFetch(`/api/users/${id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      fetchUsers();
    } catch { /* handled */ }
  };

  const toggleActive = async (u: UserItem) => {
    try {
      await authFetch(`/api/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      fetchUsers();
    } catch { /* handled */ }
  };

  // 根据角色生成可选的角色列表
  const getRoleOptions = () => {
    if (isSuperAdmin) {
      return [
        { value: 'employee', label: '员工' },
        { value: 'admin', label: '管理员' },
        { value: 'super_admin', label: '超级管理员' },
      ];
    }
    return [{ value: 'employee', label: '员工' }];
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">用户管理</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {isSuperAdmin ? '超级管理员可管理所有用户' : '管理员仅可管理员工账号'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          新增用户
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索账号或姓名"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-[#64748B]">账号</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748B]">姓名</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748B]">角色</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748B]">状态</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748B]">创建时间</th>
              <th className="px-4 py-3 text-right font-medium text-[#64748B]">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#64748B]">加载中...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#64748B]">暂无用户</td></tr>
            ) : (
              filteredUsers.map((u) => {
                const operable = canOperate(u);
                const deletable = canDelete(u);
                return (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[#0F172A]">{u.username}</td>
                    <td className="px-4 py-3 text-[#0F172A]">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(u.role)}`}>
                        {getRoleIcon(u.role)}
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {operable ? (
                        <button
                          onClick={() => toggleActive(u)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                            u.is_active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                          }`}
                        >
                          {u.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                          {u.is_active ? '启用' : '禁用'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                        }`}>
                          {u.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                          {u.is_active ? '启用' : '禁用'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {new Date(u.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {operable && (
                          <button
                            onClick={() => openEdit(u)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {deletable && (
                          <button
                            onClick={() => setDeleteConfirm(u.id)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {!operable && !deletable && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <button onClick={closeModal} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-5">
              {modalMode === 'create' ? '新增用户' : '编辑用户'}
            </h2>

            <div className="space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">账号</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={modalMode === 'edit'}
                  placeholder="请输入账号"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">姓名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="请输入姓名"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">
                  密码{modalMode === 'edit' && '（留空则不修改）'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={modalMode === 'create' ? '至少 6 位' : '留空保持不变'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">角色</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  {getRoleOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {submitting ? '提交中...' : (
                  <span className="flex items-center justify-center gap-1">
                    <Check className="h-4 w-4" />
                    {modalMode === 'create' ? '创建' : '保存'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-[#0F172A] mb-2">确认删除</h3>
            <p className="text-sm text-[#64748B] mb-5">删除后该用户将无法登录系统，此操作不可撤销</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
