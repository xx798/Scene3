import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    const token = process.env.COZE_WORKLOAD_API_TOKEN;
    const workspaceId = process.env.COZE_PROJECT_SPACE_ID;

    if (!token) {
      return NextResponse.json({ error: "未配置 COZE_WORKLOAD_API_TOKEN" }, { status: 500 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: "未配置 COZE_PROJECT_SPACE_ID" }, { status: 500 });
    }

    // 调用工作流脚本
    const scriptPath = "/skills/public/prod/coze-asset-runner/workflow-runner/scripts/workflow_runner.py";
    const output = execSync(
      `python3 "${scriptPath}" list --workspace-id "${workspaceId}" 2>/dev/null`,
      { encoding: "utf8", timeout: 30000, env: { ...process.env } }
    );

    const data = JSON.parse(output);
    const items = data?.data?.items || [];

    const workflows = items.map((w: any) => ({
      id: w.workflow_id,
      name: w.workflow_name,
      description: w.description || "",
      type: "workflow",
    }));

    // 尝试调用机器人列表
    let bots: any[] = [];
    try {
      const botScriptPath = "/skills/public/prod/coze-asset-runner/bot-runner/scripts/bot_runner.py";
      const botOutput = execSync(
        `python3 "${botScriptPath}" list --workspace-id "${workspaceId}" 2>/dev/null`,
        { encoding: "utf8", timeout: 30000, env: { ...process.env } }
      );
      const botData = JSON.parse(botOutput);
      const botItems = botData?.data?.items || botData?.items || [];
      bots = botItems.map((b: any) => ({
        id: b.bot_id,
        name: b.bot_name,
        description: b.description || "",
        type: "bot",
      }));
    } catch {
      // 机器人列表可选，失败不影响
    }

    return NextResponse.json([...bots, ...workflows]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message, output: error.stdout }, { status: 500 });
  }
}