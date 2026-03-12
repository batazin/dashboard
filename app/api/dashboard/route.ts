import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { OrderStatus, Priority } from "@/types"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface StatusGroupCount {
  status: OrderStatus
  _count: { status: number }
}

interface PriorityGroupCount {
  priority: Priority
  _count: { priority: number }
}

// GET /api/dashboard - Get dashboard stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const baseWhere: any = {}

    // Role-based filtering
    if (session.user.role === "REQUESTER") {
      baseWhere.requesterId = session.user.id
    } else if (session.user.role === "PROFESSIONAL") {
      // PROFESSIONAL vê pedidos que criou OU que está atribuído
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id },
      })
      
      const orConditions: any[] = [
        { requesterId: session.user.id } // Pedidos que criou
      ]
      
      if (professional) {
        orConditions.push({ professionalId: professional.id }) // Pedidos atribuídos
      }
      
      baseWhere.OR = orConditions
    }
    // ADMIN não tem filtro - vê todos

    const [
      totalOrders,
      openOrders,
      finishedOrders,
      cancelledOrders,
      totalProfessionals,
      availableProfessionals,
      ordersByStatus,
      ordersByPriority,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count({ where: baseWhere }),
      prisma.order.count({
        where: {
          ...baseWhere,
          status: { notIn: ["FINISHED", "CANCELLED"] },
        },
      }),
      prisma.order.count({
        where: { ...baseWhere, status: "FINISHED" },
      }),
      prisma.order.count({
        where: { ...baseWhere, status: "CANCELLED" },
      }),
      prisma.professional.count(),
      prisma.professional.count({
        where: { status: "AVAILABLE" },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { status: true },
      }),
      prisma.order.groupBy({
        by: ["priority"],
        where: baseWhere,
        _count: { priority: true },
      }),
      prisma.order.findMany({
        where: baseWhere,
        include: {
          requester: true,
          professional: { include: { user: true } },
          tags: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    return NextResponse.json({
      totalOrders,
      openOrders,
      finishedOrders,
      cancelledOrders,
      totalProfessionals,
      availableProfessionals,
      ordersByStatus: ordersByStatus.map((item: StatusGroupCount) => ({
        status: item.status,
        count: item._count.status,
      })),
      ordersByPriority: ordersByPriority.map((item: PriorityGroupCount) => ({
        priority: item.priority,
        count: item._count.priority,
      })),
      recentOrders,
    })
  } catch (error) {
    console.error("Error fetching dashboard:", error)
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 })
  }
}
