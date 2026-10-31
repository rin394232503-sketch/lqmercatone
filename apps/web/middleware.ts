import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware — 管理后台路由保护
 *
 * 保护规则：
 * - /manage.html — 必须管理员登录
 * - /manage-login.html — 公开访问
 *
 * 注意：由于 manage.html 是静态 HTML 文件（放在 public/ 中），
 * 服务端 middleware 无法读取客户端 localStorage。
 * 因此实际的鉴权逻辑在 manage.html 的客户端 JavaScript 中执行。
 * 此 middleware 作为额外的服务端保护层，记录访问日志。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 管理后台访问日志
  if (pathname === '/manage.html') {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';
    console.log(`[SECURITY] 管理后台访问尝试: IP=${ip}, UA=${ua.substring(0, 50)}...`);
    // 不做服务端重定向，让客户端 JS 处理鉴权
    // 因为 JWT token 存在客户端 localStorage 中
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/manage.html', '/manage-login.html'],
};
