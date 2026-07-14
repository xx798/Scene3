import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

interface DiagnoseRecord {
  id: number;
  diagnose_time: string;
  camera_id: string;
  site_name_watermark: string;
  camera_status: string;
  camera_abnormal_desc: string;
  risk_items: unknown;
  capture_time: string;
  image_url: string;
  excel_url: string;
  status: string;
}

const COZE_API_TOKEN = process.env.COZE_WORKLOAD_API_TOKEN;
const COZE_API_BASE = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
const WORKFLOW_ID = '7660403800638029824'; // To_excel_3

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date } = body as { date?: string };

    if (!date) {
      return NextResponse.json({ error: '缺少日期参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Query data for the selected date
    const dayStart = new Date(`${date}T00:00:00+08:00`);
    const dayEnd = new Date(`${date}T23:59:59+08:00`);

    const { data, error } = await client
      .from('daily_diagnose_data')
      .select('id, diagnose_time, camera_id, site_name_watermark, camera_status, camera_abnormal_desc, risk_items, capture_time, image_url, excel_url, status')
      .gte('diagnose_time', dayStart.toISOString())
      .lte('diagnose_time', dayEnd.toISOString())
      .order('diagnose_time', { ascending: true });

    if (error) throw new Error(`查询数据失败: ${error.message}`);

    const records = (data ?? []) as DiagnoseRecord[];

    if (records.length === 0) {
      return NextResponse.json({ error: '当日暂无诊断数据，无法生成报告' }, { status: 404 });
    }

    // Prepare input JSON for the workflow - match the actual diagnosis output format
    const inputJson = JSON.stringify(records.map((r) => ({
      camera_id: r.camera_id,
      site_name_watermark: r.site_name_watermark || '无',
      camera_status: r.camera_status,
      camera_abnormal_desc: r.camera_abnormal_desc || '正常',
      risk_items: r.risk_items,
      capture_time: r.capture_time,
      image_url: r.image_url,
      Excel_url: r.excel_url || '',
    })));

    // Call the workflow to generate Excel
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (COZE_API_TOKEN) {
      headers['Authorization'] = `Bearer ${COZE_API_TOKEN}`;
    }

    // Add extra headers if configured
    const extraHeaders = process.env.COZE_EXTRA_HEADERS;
    if (extraHeaders) {
      for (const pair of extraHeaders.split(';')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          headers[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
        }
      }
    }

    const workflowRes = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        parameters: {
          input_json: inputJson,
        },
      }),
    });

    if (!workflowRes.ok) {
      const errText = await workflowRes.text();
      throw new Error(`工作流调用失败: ${workflowRes.status} ${errText}`);
    }

    const workflowResult = await workflowRes.json();

    // Extract the URL from workflow output
    let fileUrl = '';
    let fileName = `诊断报告_${date}.xlsx`;
    let abnormalCount = records.filter((r) => r.status === 'abnormal').length;

    if (workflowResult.data) {
      // The workflow returns JSON string with URL, file_name, abnormal_count
      const outputData = typeof workflowResult.data === 'string'
        ? JSON.parse(workflowResult.data)
        : workflowResult.data;

      fileUrl = outputData.URL || outputData.url || '';
      fileName = outputData.file_name || fileName;
      if (outputData.abnormal_count !== undefined) {
        abnormalCount = Number(outputData.abnormal_count);
      }
    }

    // Update the excel_url for all records of this date
    if (fileUrl) {
      await client
        .from('daily_diagnose_data')
        .update({ excel_url: fileUrl })
        .gte('diagnose_time', dayStart.toISOString())
        .lte('diagnose_time', dayEnd.toISOString());
    }

    return NextResponse.json({
      success: true,
      date,
      file_name: fileName,
      url: fileUrl,
      abnormal_count: abnormalCount,
      total: records.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
