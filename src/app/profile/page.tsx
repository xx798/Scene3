'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Save, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import { authFetch } from '@/lib/auth-fetch';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  const handleUpdateName = async () => {
    if (!user || !name.trim()) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }
      
      await refreshUser();
      setMessage({ type: 'success', text: '姓名更新成功' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '更新失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '请填写所有密码字段' });
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '新密码至少6位' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的新密码不一致' });
      return;
    }
    
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      logout();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '更新失败' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">个人设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的账号信息</p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            基本信息
          </CardTitle>
          <CardDescription>修改你的显示名称</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">账号</Label>
            <Input id="username" value={user?.username || ''} disabled className="bg-gray-50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">角色</Label>
            <Input 
              id="role" 
              value={
                user?.role === 'super_admin' ? '超级管理员' : 
                user?.role === 'admin' ? '管理员' : '员工'
              } 
              disabled 
              className="bg-gray-50" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <div className="flex gap-2">
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
              />
              <Button 
                onClick={handleUpdateName}
                disabled={saving || !name.trim() || name === user?.name}
              >
                <Save className="h-4 w-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            修改密码
          </CardTitle>
          <CardDescription>定期修改密码可以提高账号安全性</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">当前密码</Label>
            <div className="relative">
              <Input 
                id="currentPassword" 
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <div className="relative">
              <Input 
                id="newPassword" 
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6位"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input 
              id="confirmPassword" 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
            />
          </div>
          <Button 
            onClick={handleUpdatePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          >
            <Lock className="h-4 w-4 mr-1" />
            更新密码
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
