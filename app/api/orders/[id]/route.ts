import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { orderUpdateSchema, orderFinishSchema } from "@/lib/validations"
import { notifyProfessionalAssigned } from "@/lib/notifications"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/orders/[id] - Get single order
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        requester: true,
        professional: { include: { user: true } },
        tags: true,
        attachments: true,
        messages: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
        statusHistory: {
          include: { changedBy: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Check access
    if (session.user.role === "REQUESTER" && order.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    if (session.user.role === "PROFESSIONAL") {
      // PROFESSIONAL pode ver pedidos que criou OU que está atribuído
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id },
      })
      
      const isRequester = order.requesterId === session.user.id
      const isAssignedProfessional = professional && order.professionalId === professional.id
      
      if (!isRequester && !isAssignedProfessional) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error fetching order:", error)
    return NextResponse.json({ error: "Erro ao buscar pedido" }, { status: 500 })
  }
}

// PATCH /api/orders/[id] - Update order
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = orderUpdateSchema.parse(body)

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { professional: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Check permissions
    const canEdit = 
      session.user.role === "ADMIN" ||
      existingOrder.requesterId === session.user.id ||
      (session.user.role === "PROFESSIONAL" && existingOrder.professional?.userId === session.user.id)

    if (!canEdit) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // If status is changing, create history entry
    const statusChanged = validatedData.status && validatedData.status !== existingOrder.status

    const updateData: any = {
      ...(validatedData.title && { title: validatedData.title }),
      ...(validatedData.description && { description: validatedData.description }),
      ...(validatedData.priority && { priority: validatedData.priority }),
      ...(validatedData.status && { status: validatedData.status }),
      ...(validatedData.pageUrl !== undefined && { pageUrl: validatedData.pageUrl || null }),
      ...(validatedData.professionalId !== undefined && { 
        professionalId: validatedData.professionalId 
      }),
    }

    // Handle tags update
    if (validatedData.tags) {
      updateData.tags = {
        set: [],
        connectOrCreate: validatedData.tags.map((tag) => ({
          where: { name: tag },
          create: { name: tag },
        })),
      }
    }

    // Handle status history
    if (statusChanged) {
      updateData.statusHistory = {
        create: {
          fromStatus: existingOrder.status,
          toStatus: validatedData.status,
          observation: validatedData.statusObservation,
          changedById: session.user.id,
        },
      }

      // If finishing, set finishedAt
      if (validatedData.status === "FINISHED") {
        updateData.finishedAt = new Date()
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        requester: true,
        professional: { include: { user: true } },
        tags: true,
        attachments: true,
        statusHistory: {
          include: { changedBy: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    // If professional assignment changed, notify the newly assigned professional
    try {
      const prevProfId = existingOrder.professional?.id || null
      const newProfId = validatedData.professionalId !== undefined ? validatedData.professionalId : prevProfId
      if (newProfId && newProfId !== prevProfId) {
        const newProf = await prisma.professional.findUnique({ where: { id: newProfId }, include: { user: true } })
        if (newProf?.user?.id) {
          await notifyProfessionalAssigned(newProf.user.id, order.id, order.title, session.user.name || "Usuário")
        }
      }
    } catch (err) {
      console.error('Error notifying newly assigned professional:', err)
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error updating order:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro ao atualizar pedido" }, { status: 500 })
  }
}

// DELETE /api/orders/[id] - Delete order
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Only admin or requester can delete
    if (session.user.role !== "ADMIN" && existingOrder.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    await prisma.order.delete({ where: { id } })

    return NextResponse.json({ message: "Pedido excluído com sucesso" })
  } catch (error) {
    console.error("Error deleting order:", error)
    return NextResponse.json({ error: "Erro ao excluir pedido" }, { status: 500 })
  }
}
