import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { messageSchema } from "@/lib/validations"
import { notifyNewMessage } from "@/lib/notifications"
import { emitMessage as emitMessageServerClient, emitNotification as emitNotificationServerClient } from "@/lib/socketServerClient"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/orders/[id]/messages - Get messages for an order
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: { professional: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Check access
    if (session.user.role === "REQUESTER" && order.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    if (session.user.role === "PROFESSIONAL") {
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id },
      })
      const isRequester = order.requesterId === session.user.id
      const isAssignedProfessional = professional && order.professionalId === professional.id
      
      if (!isRequester && !isAssignedProfessional) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
    }

    const messages = await prisma.message.findMany({
      where: { orderId: id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Erro ao buscar mensagens" }, { status: 500 })
  }
}

// POST /api/orders/[id]/messages - Create a new message
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    
    const validatedData = messageSchema.parse({ ...body, orderId: id })

    const order = await prisma.order.findUnique({
      where: { id },
      include: { professional: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Check access
    if (session.user.role === "REQUESTER" && order.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    if (session.user.role === "PROFESSIONAL") {
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id },
      })
      const isRequester = order.requesterId === session.user.id
      const isAssignedProfessional = professional && order.professionalId === professional.id
      
      if (!isRequester && !isAssignedProfessional) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
    }

    const message = await prisma.message.create({
      data: {
        content: validatedData.content,
        orderId: id,
        userId: session.user.id,
      },
      include: { user: true },
    })

    // Create notification for the other participant
    try {
      if (session.user.role === "REQUESTER") {
        // Notify the assigned professional
        if (order.professionalId) {
          const professional = await prisma.professional.findUnique({
            where: { id: order.professionalId },
            include: { user: true },
          })
          if (professional?.user) {
            console.log(`🔔 Creating notification for professional ${professional.user.id} about new message in order ${id}`)
            const notification = await notifyNewMessage(
              professional.user.id,
              id,
              order.title,
              session.user.name || "Usuário"
            )
            if (notification) {
              console.log(`✅ Message notification created: ${notification.id}`)
            }
            // If notification was created, try to inform socket-server directly as well and log response
              try {
                const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3001'
                const payload = { userId: professional.user.id, notification: { ...notification, actorId: session.user.id } }
                const emitRes = await fetch(`${SOCKET_SERVER_URL}/emit-notification`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
                console.log('/emit-notification call result:', { status: emitRes.status })
                if (!emitRes.ok) {
                  console.warn('/emit-notification non-OK, trying socket client fallback')
                  await emitNotificationServerClient(professional.user.id, notification)
                }
              } catch (err) {
                console.warn('Failed to call socket-server /emit-notification for message notification, trying socket client fallback', err)
                await emitNotificationServerClient(professional.user.id, notification)
              }
          }
        }
      } else if (session.user.role === "PROFESSIONAL") {
        // Notify the requester
        const requester = await prisma.user.findUnique({
          where: { id: order.requesterId },
        })
        if (requester) {
          console.log(`🔔 Creating notification for requester ${order.requesterId} about new message in order ${id}`)
          const notification = await notifyNewMessage(
            order.requesterId,
            id,
            order.title,
            session.user.name || "Profissional"
          )
          if (notification) {
            console.log(`✅ Message notification created: ${notification.id}`)
          }
          try {
            const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3001'
                const payload = { userId: order.requesterId, notification: { ...notification, actorId: session.user.id } }
                const emitRes = await fetch(`${SOCKET_SERVER_URL}/emit-notification`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
            console.log('/emit-notification call result:', { status: emitRes.status })
            if (!emitRes.ok) {
              console.warn('/emit-notification non-OK, trying socket client fallback')
              await emitNotificationServerClient(order.requesterId, notification)
            }
          } catch (err) {
            console.warn('Failed to call socket-server /emit-notification for message notification, trying socket client fallback', err)
            await emitNotificationServerClient(order.requesterId, notification)
          }
        }
      }
    } catch (notificationError) {
      console.error("❌ Error creating notification:", notificationError)
      // Don't fail the message creation if notification fails
    }

    // Try to notify socket server to broadcast the new message in realtime
    try {
      const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3001'
      const emitRes = await fetch(`${SOCKET_SERVER_URL}/emit-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, message }),
      })
      if (!emitRes.ok) {
        console.warn('/emit-message non-OK, trying socket client fallback')
        await emitMessageServerClient(id, message)
      }
    } catch (err) {
      console.warn('Failed to emit new message to socket server, trying socket client fallback', err)
      await emitMessageServerClient(id, message)
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error("Error creating message:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro ao criar mensagem" }, { status: 500 })
  }
}
