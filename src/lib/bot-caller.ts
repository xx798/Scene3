/**
 * Bot Caller - 调用扣子平台智能体并解析返回内容
 * 基于 Coze Open API v3/chat 实现
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";

const COZE_API_TOKEN = process.env.COZE_WORKLOAD_API_TOKEN;
const COZE_API_BASE = process.env.COZE_API_BASE_URL || "https://api.coze.cn";

interface BotChatResult {
  success: boolean;
  conversationId?: string;
  chatId?: string;
  content?: string;
  error?: string;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (COZE_API_TOKEN) {
    headers["Authorization"] = `Bearer ${COZE_API_TOKEN}`;
  }
  const extraHeaders = process.env.COZE_EXTRA_HEADERS;
  if (extraHeaders) {
    for (const pair of extraHeaders.split(";")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        headers[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
      }
    }
  }
  return headers;
}

/**
 * 调用智能体进行同步对话（自动轮询等待完成）
 */
export async function callBot(botId: string, message: string): Promise<BotChatResult> {
  const headers = buildHeaders();

  try {
    // Step 1: Create chat
    const response = await fetch(`${COZE_API_BASE}/v3/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bot_id: botId,
        user_id: `scheduler_${Date.now()}`,
        stream: false,
        additional_messages: [
          {
            role: "user",
            content: message,
            content_type: "text",
          },
        ],
        auto_save_history: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `创建对话失败: ${response.status} ${errText}` };
    }

    const chatResult = await response.json();
    const conversationId = chatResult.data?.conversation_id;
    const chatId = chatResult.data?.id;

    if (!conversationId || !chatId) {
      return { success: false, error: `对话创建异常: ${JSON.stringify(chatResult)}` };
    }

    // Step 2: Poll until completion (max 2 minutes)
    const terminalStatuses = ["completed", "failed", "canceled"];
    const maxPollTime = 120000;
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const params = new URLSearchParams({
        conversation_id: conversationId,
        chat_id: chatId,
      });

      const retrieveResponse = await fetch(
        `${COZE_API_BASE}/v3/chat/retrieve?${params}`,
        { headers }
      );

      const retrieveResult = await retrieveResponse.json();
      const status = retrieveResult.data?.status;

      if (terminalStatuses.includes(status)) {
        if (status === "failed" || status === "canceled") {
          return {
            success: false,
            conversationId,
            chatId,
            error: `对话状态: ${status}`,
          };
        }

        // Step 3: Get messages
        const messageParams = new URLSearchParams({
          conversation_id: conversationId,
          chat_id: chatId,
        });

        const messageResponse = await fetch(
          `${COZE_API_BASE}/v3/chat/message/list?${messageParams}`,
          { headers }
        );

        const messageResult = await messageResponse.json();
        const messages = messageResult.data || [];

        // Find the answer message
        const answerMsg = messages.find(
          (m: { type: string; role: string }) => m.type === "answer" && m.role === "assistant"
        );

        const content = answerMsg?.content || "";

        return {
          success: true,
          conversationId,
          chatId,
          content,
        };
      }
    }

    return { success: false, error: "对话超时（超过2分钟）" };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `调用异常: ${errMsg}` };
  }
}

/**
 * 执行一次定时任务：调用 Bot → 记录日志 → 可选入库
 */
export async function executeScheduledTask(taskId: number, botId: string, prompt: string): Promise<void> {
  const client = getSupabaseClient();

  // Create execution log
  const { data: logRow, error: logError } = await client
    .from("task_execution_logs")
    .insert({
      task_id: taskId,
      status: "running",
      prompt_sent: prompt,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (logError) {
    console.error(`[Scheduler] 创建执行日志失败: ${logError.message}`);
    return;
  }

  const logId = logRow.id as number;

  try {
    // Call the bot
    const result = await callBot(botId, prompt);

    const completedAt = new Date().toISOString();

    if (result.success) {
      // Update log with success
      await client
        .from("task_execution_logs")
        .update({
          status: "success",
          response_content: result.content,
          completed_at: completedAt,
        })
        .eq("id", logId);

      // Update task last_run_at
      await client
        .from("scheduled_tasks")
        .update({ last_run_at: completedAt })
        .eq("id", taskId);

      console.log(`[Scheduler] 任务 ${taskId} 执行成功, logId=${logId}`);
    } else {
      // Update log with failure
      await client
        .from("task_execution_logs")
        .update({
          status: "failed",
          error_message: result.error,
          completed_at: completedAt,
        })
        .eq("id", logId);

      console.error(`[Scheduler] 任务 ${taskId} 执行失败: ${result.error}`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await client
      .from("task_execution_logs")
      .update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", logId);

    console.error(`[Scheduler] 任务 ${taskId} 执行异常: ${errMsg}`);
  }
}
