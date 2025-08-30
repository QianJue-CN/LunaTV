import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // 清除认证cookie
  response.cookies.set('auth', '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax', // 改为 lax 以支持 PWA
    httpOnly: false, // PWA 需要客户端可访问
    secure: process.env.NODE_ENV === 'production', // 生产环境使用 secure
  });

  return response;
}
