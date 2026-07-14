import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { getSupabaseServiceRoleKey, getSupabaseCredentials } from "./supabase-client"
import * as schema from "./shared/schema"

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * 获取 Drizzle ORM 数据库客户端（单例）
 * 使用 Supabase 的 service_role key 连接 PostgreSQL
 */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db

  const creds = getSupabaseCredentials()
  const serviceKey = getSupabaseServiceRoleKey()

  // 构建 PostgreSQL 连接字符串
  // Supabase URL 格式: https://xxx.supabase.co
  // PostgreSQL 直连需要: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
  const url = new URL(creds.url)
  const host = url.hostname
  // 将 api 域名转换为 db 域名
  const dbHost = host.replace(".supabase.co", ".supabase.co")

  const connectionString = `postgresql://postgres:${serviceKey}@${dbHost}:5432/postgres`

  const queryClient = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  _db = drizzle(queryClient, { schema })
  return _db
}

// 导出 db 作为默认实例（延迟初始化）
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop, receiver) {
    const instance = getDb()
    return Reflect.get(instance, prop, receiver)
  },
})
