import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ user });
}
