import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  is_active: boolean;
  token_version: number;
  created_at: string;
  updated_at: string;
}

export interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
  is_active: boolean;
}

const SALT_ROUNDS = 10;

function getAdminClient() {
  return getSupabaseClient();
}

export async function findByUsername(username: string): Promise<UserRecord | null> {
  const client = getAdminClient();
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('username', username)
    .single();
  if (error || !data) return null;
  return data as UserRecord;
}

export async function findById(id: number): Promise<UserRecord | null> {
  const client = getAdminClient();
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as UserRecord;
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function listUsers(): Promise<UserInfo[]> {
  const client = getAdminClient();
  const { data, error } = await client
    .from('users')
    .select('id, username, name, role, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as UserInfo[];
}

export async function createUser(params: {
  username: string;
  password: string;
  name: string;
  role: string;
}): Promise<UserInfo> {
  const client = getAdminClient();
  const passwordHash = await hashPassword(params.password);
  const { data, error } = await client
    .from('users')
    .insert({
      username: params.username,
      password_hash: passwordHash,
      name: params.name,
      role: params.role,
    })
    .select('id, username, name, role, is_active, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as UserInfo;
}

export async function updateUser(id: number, params: {
  name?: string;
  role?: string;
  is_active?: boolean;
  password?: string;
}): Promise<UserInfo | null> {
  const client = getAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.name !== undefined) updates.name = params.name;
  if (params.role !== undefined) updates.role = params.role;
  if (params.is_active !== undefined) updates.is_active = params.is_active;
  if (params.password !== undefined) {
    updates.password_hash = await hashPassword(params.password);
  }
  const { data, error } = await client
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, username, name, role, is_active, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as UserInfo;
}

export async function deleteUser(id: number): Promise<void> {
  const client = getAdminClient();
  const { error } = await client
    .from('users')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function incrementTokenVersion(id: number): Promise<void> {
  const client = getAdminClient();
  await client
    .from('users')
    .update({ token_version: new Date().getTime() })
    .eq('id', id);
}

export async function getTokenVersion(id: number): Promise<number> {
  const client = getAdminClient();
  const { data } = await client
    .from('users')
    .select('token_version')
    .eq('id', id)
    .single();
  return data?.token_version ?? 0;
}
