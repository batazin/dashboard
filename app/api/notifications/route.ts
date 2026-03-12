import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/notifications - Lista notificações do usuário
export async function GET(request: NextRequest) {
  try {
    const safeUrl = request.url.length > 180 ? `${request.url.slice(0, 180)}...` : request.url
    console.log('[api/notifications] Incoming request:', {
      url: safeUrl,
      method: request.method,
      host: request.headers.get('host'),
      xForwardedHost: request.headers.get('x-forwarded-host'),
      accept: request.headers.get('accept'),
    })
    // Defensive normalization of duplicated host-like path segments
    const hostPattern = /(?:https?:\/\/)?(?:127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?\d?\d)){3}|localhost|0\.0\.0\.0|\[::1\])(?::\d+)?/g
    if (request.url.includes('localhost:3000/localhost:3000') || hostPattern.test(request.url)) {
      console.warn('[api/notifications] Detected duplicated host in request.url:', request.url)
    }
    // Build a normalized URL without repeated host path segments to safely parse query params
    let normalizedUrl = null
    try {
      const incomingUrl = new URL(request.url)
      const cleanPath = incomingUrl.pathname.replace(new RegExp(`/(?:${['localhost','127.0.0.1','0.0.0.0','::1'].join('|')})(?::\\d+)?`, 'g'), '') || '/'
      if (cleanPath !== incomingUrl.pathname) {
        incomingUrl.pathname = cleanPath
        normalizedUrl = incomingUrl
          console.log('[api/notifications] Normalized request pathname:', { original: safeUrl, normalized: incomingUrl.toString() })
      }
    } catch (err) {
      // ignore and continue with request.url
      console.warn('[api/notifications] Failed to parse request.url for normalization', err)
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = normalizedUrl ?? new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"

    const where: { userId: string; read?: boolean } = {
      userId: session.user.id,
    }

    if (unreadOnly) {
      where.read = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Erro ao buscar notificações" },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications - Marca notificações como lidas
export async function PATCH(request: NextRequest) {
  try {
    console.log('[api/notifications] Incoming PATCH request:', { url: request.url, method: request.method, host: request.headers.get('host') })
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, markAllRead } = body

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: { read: true },
      })
    } else if (notificationIds?.length) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating notifications:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar notificações" },
      { status: 500 }
    )
  }
}
