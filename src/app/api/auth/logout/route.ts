import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';
import { incrementTokenVersion } from '@/lib/db-users';

export async function POST(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error }, { status });
  }

  await incrementTokenVersion(user.userId);
  return NextResponse.json({ success: true });
}
