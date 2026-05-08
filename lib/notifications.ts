import { pusherServer } from './pusher'
import prisma from './prisma'


type NotificationType = "ORDER_ASSIGNED" | "ORDER_STATUS_CHANGED" | "NEW_MESSAGE" | "ORDER_FINISHED"

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  orderId?: string
  silent?: boolean
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  orderId,
  silent = false,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        orderId,
        silent,
      } as any,
    })
    
    console.log(`✅ Notification created for user ${userId}: ${title}`)
    // Push realtime notification via Pusher
    try {
      await pusherServer.trigger(`user-${userId}`, 'new-notification', notification)
      console.log('📣 Pusher notification sent to user', userId)
    } catch (emitErr) {
      console.warn('🚨 Failed to trigger Pusher event for notification', emitErr)
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
    WAITING_CONFIRMATION: "Aguardando Confirmação",
    FINISHED: "Finalizado",
    CANCELLED: "Cancelado",
  }

  return createNotification({
    userId,
    type: "ORDER_STATUS_CHANGED",
    title: "Status do pedido alterado",
    message: `O pedido "${orderTitle}" foi alterado para "${statusLabels[newStatus] || newStatus}" por ${changedByName}.`,
    orderId,
    silent: newStatus === "WAITING_CONFIRMATION",
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
