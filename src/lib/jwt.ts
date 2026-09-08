import { SignJWT, jwtVerify } from 'jose';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  version: number;
}



function getSecretKey(): Uint8Array {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('APP_JWT_SECRET 至少需要 32 个字符');
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload, expiresIn = '24h'): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
  return token;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      role: payload.role as string,
      version: payload.version as number,
    };
  } catch {
    return null;
  }
}
