import { NextResponse } from "next/server"

/**
 * GET /api/health
 *
 * 健康检查接口，供外部心跳服务或负载均衡器探活。
 * 返回 200 即表示服务可用。
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
}
