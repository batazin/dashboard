import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  try {
    const url = request.nextUrl.clone()
    const pathname = url.pathname
    // Normalize repeated host segments like '/localhost:3000/localhost:3000/...'
    // and remove any leading/trailing host-like path segments (e.g., 127.0.0.1)
    const hostPattern = /\/(?:https?:\/\/)?(?:127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?\d?\d)){3}|localhost|0\.0\.0\.0|\[::1\])(?::\d+)?/g
    if (hostPattern.test(pathname)) {
      const normalized = pathname.replace(hostPattern, '') || '/'
      if (normalized !== pathname) {
        url.pathname = normalized
        console.warn('[middleware] Normalized path (host segments removed)', { original: pathname, normalized })
        // Rewrite internally to avoid redirect loops while still normalizing the incoming request
        const rewritten = NextResponse.rewrite(url)
        rewritten.headers.set('x-normalized-from', pathname)
        rewritten.headers.set('x-original-request-method', request.method)
        return rewritten
      }
    }
  } catch (err) {
    console.error('[middleware] Error while normalizing path', err)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
