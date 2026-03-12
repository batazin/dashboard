import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/reports - Get orders statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // Filtro base por role
    const baseWhere: any = {}
    
    if (session.user.role === "REQUESTER") {
      baseWhere.requesterId = session.user.id
    } else if (session.user.role === "PROFESSIONAL") {
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id },
      })
      
      const orConditions: any[] = [{ requesterId: session.user.id }]
      if (professional) {
        orConditions.push({ professionalId: professional.id })
      }
      baseWhere.OR = orConditions
    }

    // Filtro de data
    const dateFilter: any = {}
    if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
    }

    const whereWithDate = dateFrom || dateTo 
      ? { ...baseWhere, createdAt: dateFilter }
      : baseWhere

    // Estatísticas gerais
    const [
      totalOrders,
      ordersByStatus,
      ordersByPriority,
      ordersByMonth,
      avgCompletionTime,
      topRequesters,
      topProfessionals,
    ] = await Promise.all([
      // Total de pedidos
      prisma.order.count({ where: whereWithDate }),
      
      // Por status
      prisma.order.groupBy({
        by: ["status"],
        where: whereWithDate,
        _count: { status: true },
      }),
      
      // Por prioridade
      prisma.order.groupBy({
        by: ["priority"],
        where: whereWithDate,
        _count: { priority: true },
      }),
      
      // Por mês (últimos 12 meses)
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'FINISHED') as finished,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
          COUNT(*) FILTER (WHERE status NOT IN ('FINISHED', 'CANCELLED')) as open
        FROM "Order"
        WHERE "createdAt" >= NOW() - INTERVAL '12 months'
        ${session.user.role === "REQUESTER" ? prisma.$queryRaw`AND "requesterId" = ${session.user.id}` : prisma.$queryRaw``}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `.catch(() => []),
      
      // Tempo médio de conclusão (em dias)
      prisma.$queryRaw`
        SELECT 
          AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400) as avg_days
        FROM "Order"
        WHERE status = 'FINISHED'
        ${session.user.role === "REQUESTER" ? prisma.$queryRaw`AND "requesterId" = ${session.user.id}` : prisma.$queryRaw``}
      `.catch(() => [{ avg_days: null }]),
      
      // Top solicitantes (apenas para ADMIN)
      session.user.role === "ADMIN" 
        ? prisma.order.groupBy({
            by: ["requesterId"],
            where: whereWithDate,
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
          })
        : [],
      
      // Top profissionais
      prisma.order.groupBy({
        by: ["professionalId"],
        where: { 
          ...whereWithDate,
          professionalId: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ])

    // Buscar nomes dos requesters
    let topRequestersWithNames: any[] = []
    if (Array.isArray(topRequesters) && topRequesters.length > 0) {
      const requesterIds = topRequesters.map((r: any) => r.requesterId)
      const requesters = await prisma.user.findMany({
        where: { id: { in: requesterIds } },
        select: { id: true, name: true, email: true },
      })
      topRequestersWithNames = topRequesters.map((r: any) => {
        const user = requesters.find((u) => u.id === r.requesterId)
        return {
          id: r.requesterId,
          name: user?.name || user?.email || "Desconhecido",
          count: r._count.id,
        }
      })
    }

    // Buscar nomes dos profissionais
    let topProfessionalsWithNames: any[] = []
    if (Array.isArray(topProfessionals) && topProfessionals.length > 0) {
      const professionalIds = topProfessionals
        .map((p: any) => p.professionalId)
        .filter(Boolean)
      const professionals = await prisma.professional.findMany({
        where: { id: { in: professionalIds } },
        include: { user: { select: { name: true, email: true } } },
      })
      topProfessionalsWithNames = topProfessionals.map((p: any) => {
        const prof = professionals.find((pr) => pr.id === p.professionalId)
        return {
          id: p.professionalId,
          name: prof?.user?.name || prof?.user?.email || "Desconhecido",
          specialty: prof?.specialty || "N/A",
          count: p._count.id,
        }
      })
    }

    // Processar dados por status
    const statusData = {
      NEW: 0,
      IN_ANALYSIS: 0,
      IN_PROGRESS: 0,
      WAITING_CLIENT: 0,
      FINISHED: 0,
      CANCELLED: 0,
    }
    ordersByStatus.forEach((item: any) => {
      statusData[item.status as keyof typeof statusData] = item._count.status
    })

    // Processar dados por prioridade
    const priorityData = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    }
    ordersByPriority.forEach((item: any) => {
      priorityData[item.priority as keyof typeof priorityData] = item._count.priority
    })

    // Calcular métricas
    const openOrders = statusData.NEW + statusData.IN_ANALYSIS + 
                       statusData.IN_PROGRESS + statusData.WAITING_CLIENT
    const finishedOrders = statusData.FINISHED
    const cancelledOrders = statusData.CANCELLED
    const completionRate = totalOrders > 0 
      ? Math.round((finishedOrders / totalOrders) * 100) 
      : 0
    const cancellationRate = totalOrders > 0 
      ? Math.round((cancelledOrders / totalOrders) * 100) 
      : 0

    // Processar tempo médio
    const avgDays = Array.isArray(avgCompletionTime) && avgCompletionTime[0]?.avg_days
      ? Math.round(Number(avgCompletionTime[0].avg_days) * 10) / 10
      : null

    // Processar dados mensais
    const monthlyData = Array.isArray(ordersByMonth) 
      ? ordersByMonth.map((m: any) => ({
          month: m.month,
          total: Number(m.total),
          finished: Number(m.finished),
          cancelled: Number(m.cancelled),
          open: Number(m.open),
        }))
      : []

    return NextResponse.json({
      summary: {
        totalOrders,
        openOrders,
        finishedOrders,
        cancelledOrders,
        completionRate,
        cancellationRate,
        avgCompletionDays: avgDays,
      },
      byStatus: statusData,
      byPriority: priorityData,
      monthlyData,
      topRequesters: topRequestersWithNames,
      topProfessionals: topProfessionalsWithNames,
    })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json({ error: "Erro ao buscar relatórios" }, { status: 500 })
  }
}
