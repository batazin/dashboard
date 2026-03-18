import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/reports/tags - Get tag usage statistics
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
    if (dateFrom || dateTo) {
      baseWhere.createdAt = {}
      if (dateFrom) baseWhere.createdAt.gte = new Date(dateFrom)
      if (dateTo) baseWhere.createdAt.lte = new Date(dateTo)
    }

    // Buscar todas as tags com contagem de pedidos
    const tagsWithCount = await prisma.tag.findMany({
      include: {
        _count: {
          select: { orders: true }
        },
        orders: {
          where: baseWhere,
          select: {
            id: true,
            status: true,
            priority: true,
            createdAt: true,
          }
        }
      },
      orderBy: {
        orders: {
          _count: "desc"
        }
      }
    })

    // Processar estatísticas
    const tagStats = tagsWithCount.map(tag => {
      const orders = tag.orders
      const totalOrders = orders.length
      
      // Contagem por status
      const byStatus = {
        NEW: orders.filter(o => (o.status as string) === "NEW").length,
        IN_ANALYSIS: orders.filter(o => (o.status as string) === "IN_ANALYSIS").length,
        IN_PROGRESS: orders.filter(o => (o.status as string) === "IN_PROGRESS").length,
        WAITING_CLIENT: orders.filter(o => (o.status as string) === "WAITING_CLIENT").length,
        WAITING_CONFIRMATION: orders.filter(o => (o.status as string) === "WAITING_CONFIRMATION").length,
        FINISHED: orders.filter(o => (o.status as string) === "FINISHED").length,
        CANCELLED: orders.filter(o => (o.status as string) === "CANCELLED").length,
      }

      // Contagem por prioridade
      const byPriority = {
        LOW: orders.filter(o => o.priority === "LOW").length,
        MEDIUM: orders.filter(o => o.priority === "MEDIUM").length,
        HIGH: orders.filter(o => o.priority === "HIGH").length,
        URGENT: orders.filter(o => o.priority === "URGENT").length,
      }

      // Taxa de conclusão
      const completionRate = totalOrders > 0 
        ? Math.round((byStatus.FINISHED / totalOrders) * 100) 
        : 0

      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        totalOrders,
        byStatus,
        byPriority,
        completionRate,
      }
    }).filter(tag => tag.totalOrders > 0) // Só tags com pedidos

    // Estatísticas gerais
    const totalTags = tagStats.length
    const totalOrdersWithTags = tagStats.reduce((sum, tag) => sum + tag.totalOrders, 0)
    const topTags = tagStats.slice(0, 10)
    
    // Tags por mês (últimos 6 meses)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const ordersWithTags = await prisma.order.findMany({
      where: {
        ...baseWhere,
        createdAt: { gte: sixMonthsAgo },
        tags: { some: {} }
      },
      select: {
        createdAt: true,
        tags: { select: { name: true } }
      }
    })

    // Agrupar por mês
    const monthlyData: Record<string, Record<string, number>> = {}
    
    ordersWithTags.forEach(order => {
      const monthKey = order.createdAt.toISOString().slice(0, 7) // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {}
      }
      order.tags.forEach(tag => {
        monthlyData[monthKey][tag.name] = (monthlyData[monthKey][tag.name] || 0) + 1
      })
    })

    // Converter para array ordenado
    const monthlyStats = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, tags]) => ({
        month,
        tags: Object.entries(tags)
          .sort(([, a], [, b]) => b - a)
          .map(([name, count]) => ({ name, count }))
      }))

    return NextResponse.json({
      summary: {
        totalTags,
        totalOrdersWithTags,
        avgTagsPerOrder: totalOrdersWithTags > 0 
          ? (tagStats.reduce((sum, t) => sum + t.totalOrders, 0) / totalOrdersWithTags).toFixed(1)
          : 0,
      },
      topTags,
      allTags: tagStats,
      monthlyStats,
    })
  } catch (error) {
    console.error("Error fetching tag reports:", error)
    return NextResponse.json({ error: "Erro ao buscar relatórios" }, { status: 500 })
  }
}
