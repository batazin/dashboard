import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { 
  ClipboardList, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  PlayCircle,
  PauseCircle,
  XCircle,
  Sparkles,
  Search,
  Hourglass
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge, PriorityBadge } from "@/components/orders/status-badge"
import { formatDate } from "@/lib/utils"

async function getDashboardData(userId: string, role: string) {
  const baseWhere: any = {}

  if (role === "REQUESTER") {
    baseWhere.requesterId = userId
  } else if (role === "PROFESSIONAL") {
    const professional = await prisma.professional.findUnique({
      where: { userId },
    })
    
    const orConditions: any[] = [{ requesterId: userId }]
    if (professional) {
      orConditions.push({ professionalId: professional.id })
    }
    baseWhere.OR = orConditions
  }

  const [
    totalOrders,
    openOrders,
    finishedOrders,
    urgentOrders,
    totalProfessionals,
    availableProfessionals,
    recentOrders,
    // Contagem por status
    newOrders,
    inAnalysisOrders,
    inProgressOrders,
    waitingClientOrders,
    waitingConfirmationOrders,
    cancelledOrders,
  ] = await Promise.all([
    prisma.order.count({ where: baseWhere }),
    prisma.order.count({
      where: { ...baseWhere, status: { notIn: ["FINISHED", "CANCELLED"] } },
    }),
    prisma.order.count({ where: { ...baseWhere, status: "FINISHED" } }),
    prisma.order.count({ where: { ...baseWhere, priority: "URGENT", status: { notIn: ["FINISHED", "CANCELLED"] } } }),
    prisma.professional.count(),
    prisma.professional.count({ where: { status: "AVAILABLE" } }),
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
    // Contagem por status individual
    prisma.order.count({ where: { ...baseWhere, status: "NEW" } }),
    prisma.order.count({ where: { ...baseWhere, status: "IN_ANALYSIS" } }),
    prisma.order.count({ where: { ...baseWhere, status: "IN_PROGRESS" } }),
    prisma.order.count({ where: { ...baseWhere, status: "WAITING_CLIENT" } }),
    prisma.order.count({ where: { ...baseWhere, status: "WAITING_CONFIRMATION" } }),
    prisma.order.count({ where: { ...baseWhere, status: "CANCELLED" } }),
  ])

  return {
    totalOrders,
    openOrders,
    finishedOrders,
    urgentOrders,
    totalProfessionals,
    availableProfessionals,
    recentOrders,
    // Status individuais
    statusCounts: {
      NEW: newOrders,
      IN_ANALYSIS: inAnalysisOrders,
      IN_PROGRESS: inProgressOrders,
      WAITING_CLIENT: waitingClientOrders,
      WAITING_CONFIRMATION: waitingConfirmationOrders,
      FINISHED: finishedOrders,
      CANCELLED: cancelledOrders,
    }
  }
}

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
type RecentOrder = DashboardData["recentOrders"][number]
type OrderTag = RecentOrder["tags"][number]

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return null
  }

  const data = await getDashboardData(session.user.id, session.user.role)

  const stats = [
    {
      name: "Total de Pedidos",
      value: data.totalOrders,
      icon: ClipboardList,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      name: "Pedidos em Aberto",
      value: data.openOrders,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      name: "Finalizados",
      value: data.finishedOrders,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      name: "Urgentes",
      value: data.urgentOrders,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ]

  const pendingOrders = data.recentOrders.filter(
    (o) => o.status !== "FINISHED" && o.status !== "CANCELLED"
  )
  const finishedOrders = data.recentOrders.filter((o) => o.status === "FINISHED")

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Bem-vindo, {session.user.name || "Usuário"}!
          </p>
        </div>
        <Link href="/orders/new">
          <Button>Novo Pedido</Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Professionals Stats (Admin only) */}
      {session.user.role === "ADMIN" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total de Profissionais</p>
                  <p className="text-2xl font-bold">{data.totalProfessionals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Profissionais Disponíveis</p>
                  <p className="text-2xl font-bold">{data.availableProfessionals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aguardando Ação */}
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Hourglass className="h-5 w-5 text-yellow-600" />
              Aguardando Ação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link 
              href="/orders?status=NEW" 
              className="flex items-center justify-between p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Novos</span>
              </div>
              <span className="text-lg font-bold text-purple-600">{data.statusCounts.NEW}</span>
            </Link>
            <Link 
              href="/orders?status=WAITING_CLIENT" 
              className="flex items-center justify-between p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PauseCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Aguardando Cliente</span>
              </div>
              <span className="text-lg font-bold text-orange-600">{data.statusCounts.WAITING_CLIENT}</span>
            </Link>
            <Link 
              href="/orders?status=WAITING_CONFIRMATION" 
              className="flex items-center justify-between p-3 rounded-lg bg-cyan-50 hover:bg-cyan-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium text-cyan-800">Aguardando Confirmação</span>
              </div>
              <span className="text-lg font-bold text-cyan-600">{data.statusCounts.WAITING_CONFIRMATION}</span>
            </Link>
          </CardContent>
        </Card>

        {/* Em Andamento */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-600" />
              Em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link 
              href="/orders?status=IN_ANALYSIS" 
              className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Search className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Em Análise</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">{data.statusCounts.IN_ANALYSIS}</span>
            </Link>
            <Link 
              href="/orders?status=IN_PROGRESS" 
              className="flex items-center justify-between p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PlayCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Em Execução</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{data.statusCounts.IN_PROGRESS}</span>
            </Link>
          </CardContent>
        </Card>

        {/* Concluídos */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Concluídos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link 
              href="/orders?status=FINISHED" 
              className="flex items-center justify-between p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Finalizados</span>
              </div>
              <span className="text-lg font-bold text-green-600">{data.statusCounts.FINISHED}</span>
            </Link>
            <Link 
              href="/orders?status=CANCELLED" 
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">Cancelados</span>
              </div>
              <span className="text-lg font-bold text-gray-600">{data.statusCounts.CANCELLED}</span>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Pending Orders (horizontal) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pedidos Pendentes</CardTitle>
          <Link href="/orders?status=IN_PROGRESS">
            <Button variant="ghost" size="sm" className="gap-1">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum pedido pendente.</div>
          ) : (
            <div className="-mx-2">
              <div className="flex gap-4 overflow-x-auto py-2 px-2">
                {pendingOrders.map((order: RecentOrder) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="min-w-[280px] shrink-0 p-4 rounded-lg border hover:shadow-lg hover:scale-[1.01] transition-transform bg-white"
                  >
                    <div className="flex flex-col justify-between h-full">
                      <div>
                        <h3 className="font-medium text-sm mb-1 truncate">{order.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="truncate">{order.requester.name}</span>
                          <span>•</span>
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                        {order.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {order.tags.map((tag: OrderTag) => (
                              <span
                                key={tag.id}
                                className="px-2 py-0.5 text-xs rounded-full"
                                style={{ backgroundColor: tag.color + "20", color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.status} />
                          <PriorityBadge priority={order.priority} />
                        </div>
                        <div className="text-xs text-gray-400">{order.tags.length > 0 ? order.tags[0].name : ''}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico (Finalizados) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico</CardTitle>
          <Link href="/orders?status=FINISHED">
            <Button variant="ghost" size="sm" className="gap-1">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {finishedOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum pedido finalizado recente.</div>
          ) : (
            <div className="-mx-2">
              <div className="flex gap-4 overflow-x-auto py-2 px-2">
                {finishedOrders.map((order: RecentOrder) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="min-w-[280px] shrink-0 p-4 rounded-lg border hover:shadow-lg hover:scale-[1.01] transition-transform bg-white"
                  >
                    <div className="flex flex-col justify-between h-full">
                      <div>
                        <h3 className="font-medium text-sm mb-1 truncate">{order.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="truncate">{order.requester.name}</span>
                          <span>•</span>
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                        {order.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {order.tags.map((tag: OrderTag) => (
                              <span
                                key={tag.id}
                                className="px-2 py-0.5 text-xs rounded-full"
                                style={{ backgroundColor: tag.color + "20", color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.status} />
                          <PriorityBadge priority={order.priority} />
                        </div>
                        <div className="text-xs text-gray-400">{order.tags.length > 0 ? order.tags[0].name : ''}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders (exclude FINISHED to avoid duplication) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pedidos Recentes</CardTitle>
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="gap-1">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentOrders.filter((o) => o.status !== "FINISHED").length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum pedido encontrado.{" "}
              <Link href="/orders/new" className="text-indigo-600 hover:underline">
                Criar primeiro pedido
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentOrders
                .filter((order: RecentOrder) => order.status !== "FINISHED")
                .map((order: RecentOrder) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="font-medium">{order.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                          <span>{order.requester.name}</span>
                          <span>•</span>
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={order.status} />
                        <PriorityBadge priority={order.priority} />
                      </div>
                    </div>
                    {order.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {order.tags.map((tag: OrderTag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{ backgroundColor: tag.color + "20", color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
