import prisma from "@/lib/prisma"
import { emitNotification as emitNotificationServerClient } from './socketServerClient'

type NotificationType = "ORDER_ASSIGNED" | "ORDER_STATUS_CHANGED" | "NEW_MESSAGE" | "ORDER_FINISHED"

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  orderId?: string
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  orderId,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        orderId,
      },
    })
    
    console.log(`✅ Notification created for user ${userId}: ${title}`)
    // Attempt to notify the socket-server so connected clients get realtime updates
    try {
      const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3001'
      // First try HTTP endpoint
      let res: Response | null = null
      try {
        res = await fetch(`${SOCKET_SERVER_URL}/emit-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, notification }),
        })
      } catch (err) {
        // If HTTP fails, fallback to server-side socket client emit, which attempts a direct socket.io connection
        const ok = await emitNotificationServerClient(userId, notification)
        if (!ok) throw err
      }
      if (res && !res.ok) {
        const txt = await res.text().catch(() => '')
        console.warn('🚨 /emit-notification responded with non-OK', { status: res.status, text: txt })
      } else {
        console.log('📣 /emit-notification sent to socket server for user', userId)
      }
    } catch (emitErr) {
      // Don't fail if socket-server is not reachable; dev logs are helpful
      console.warn('🚨 Failed to emit notification to socket server', emitErr)
    }

    return notification
  } catch (error) {
    console.error("Error creating notification:", error)
    return null
  }
}

export async function notifyProfessionalAssigned(
  professionalUserId: string,
  orderId: string,
  orderTitle: string,
  requesterName: string
) {
  return createNotification({
    userId: professionalUserId,
    type: "ORDER_ASSIGNED",
    title: "Novo pedido atribuído",
    message: `O pedido "${orderTitle}" foi atribuído a você por ${requesterName}.`,
    orderId,
  })
}

export async function notifyStatusChanged(
  userId: string,
  orderId: string,
  orderTitle: string,
  newStatus: string,
  changedByName: string
) {
  const statusLabels: Record<string, string> = {
    NEW: "Novo",
    IN_ANALYSIS: "Em Análise",
    IN_PROGRESS: "Em Execução",
    WAITING_CLIENT: "Aguardando Cliente",
    FINISHED: "Finalizado",
    CANCELLED: "Cancelado",
  }

  return createNotification({
    userId,
    type: "ORDER_STATUS_CHANGED",
    title: "Status do pedido alterado",
    message: `O pedido "${orderTitle}" foi alterado para "${statusLabels[newStatus] || newStatus}" por ${changedByName}.`,
    orderId,
  })
}

export async function notifyNewMessage(
  userId: string,
  orderId: string,
  orderTitle: string,
  senderName: string
) {
  return createNotification({
    userId,
    type: "NEW_MESSAGE",
    title: "Nova mensagem",
    message: `${senderName} enviou uma mensagem no pedido "${orderTitle}".`,
    orderId,
  })
}

export async function notifyOrderFinished(
  userId: string,
  orderId: string,
  orderTitle: string
) {
  return createNotification({
    userId,
    type: "ORDER_FINISHED",
    title: "Pedido finalizado",
    message: `O pedido "${orderTitle}" foi finalizado.`,
    orderId,
  })
}
