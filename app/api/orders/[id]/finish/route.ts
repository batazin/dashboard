import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { orderFinishSchema } from "@/lib/validations"

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/orders/[id]/finish - Finish an order with feedback
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = orderFinishSchema.parse(body)

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { professional: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Check if already finished
    if (existingOrder.status === "FINISHED") {
      return NextResponse.json({ error: "Pedido já está finalizado" }, { status: 400 })
    }

    // Check permissions - only requester, professional or admin can finish
    const canFinish =
      session.user.role === "ADMIN" ||
      existingOrder.requesterId === session.user.id ||
      (session.user.role === "PROFESSIONAL" && existingOrder.professional?.userId === session.user.id)

    if (!canFinish) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: "FINISHED",
        feedback: validatedData.feedback,
        rating: validatedData.rating,
        finishedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: existingOrder.status,
            toStatus: "FINISHED",
            observation: validatedData.feedback || "Pedido finalizado",
            changedById: session.user.id,
          },
        },
      },
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

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error finishing order:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro ao finalizar pedido" }, { status: 500 })
  }
}
