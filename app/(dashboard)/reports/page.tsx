"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Tag, 
  Calendar,
  Download,
  Filter,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Timer
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { statusLabels, priorityLabels } from "@/lib/utils"

interface TagStat {
  id: string
  name: string
  color: string
  totalOrders: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  completionRate: number
}

interface TagReportData {
  summary: {
    totalTags: number
    totalOrdersWithTags: number
    avgTagsPerOrder: string
  }
  topTags: TagStat[]
  allTags: TagStat[]
  monthlyStats: Array<{
    month: string
    tags: Array<{ name: string; count: number }>
  }>
}

interface OrderReportData {
  summary: {
    totalOrders: number
    openOrders: number
    finishedOrders: number
    cancelledOrders: number
    completionRate: number
    cancellationRate: number
    avgCompletionDays: number | null
  }
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  monthlyData: Array<{
    month: string
    total: number
    finished: number
    cancelled: number
    open: number
  }>
  topRequesters: Array<{ id: string; name: string; count: number }>
  topProfessionals: Array<{ id: string; name: string; specialty: string; count: number }>
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"orders" | "tags">("orders")
  const [tagData, setTagData] = useState<TagReportData | null>(null)
  const [orderData, setOrderData] = useState<OrderReportData | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedTag, setSelectedTag] = useState<TagStat | null>(null)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const [tagsResponse, ordersResponse] = await Promise.all([
        fetch(`/api/reports/tags?${params}`),
        fetch(`/api/reports?${params}`),
      ])
      
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json()
        setTagData(tagsData)
      }
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrderData(ordersData)
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os relatórios",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleFilter = () => {
    fetchReports()
  }

  const exportOrdersToCSV = () => {
    if (!orderData) return

    const headers = ["Mês", "Total", "Finalizados", "Cancelados", "Em Aberto"]
    const rows = orderData.monthlyData.map(m => [
      m.month,
      m.total,
      m.finished,
      m.cancelled,
      m.open,
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio-pedidos-${new Date().toISOString().split("T")[0]}.csv`
    link.click()

    toast({
      title: "Exportado!",
      description: "Relatório de pedidos exportado com sucesso",
      variant: "success",
    })
  }

  const exportTagsToCSV = () => {
    if (!tagData) return

    const headers = ["Tag", "Total de Pedidos", "Taxa de Conclusão", "Novos", "Em Análise", "Em Execução", "Aguardando Cliente", "Finalizados", "Cancelados"]
    const rows = tagData.allTags.map(tag => [
      tag.name,
      tag.totalOrders,
      `${tag.completionRate}%`,
      tag.byStatus.NEW,
      tag.byStatus.IN_ANALYSIS,
      tag.byStatus.IN_PROGRESS,
      tag.byStatus.WAITING_CLIENT,
      tag.byStatus.FINISHED,
      tag.byStatus.CANCELLED,
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio-tags-${new Date().toISOString().split("T")[0]}.csv`
    link.click()

    toast({
      title: "Exportado!",
      description: "Relatório de tags exportado com sucesso",
      variant: "success",
    })
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-")
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    NEW: "#9333ea",
    IN_ANALYSIS: "#eab308",
    IN_PROGRESS: "#3b82f6",
    WAITING_CLIENT: "#f97316",
    FINISHED: "#22c55e",
    CANCELLED: "#6b7280",
  }

  const priorityColors: Record<string, string> = {
    LOW: "#6b7280",
    MEDIUM: "#3b82f6",
    HIGH: "#f97316",
    URGENT: "#ef4444",
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
          <p className="text-gray-500">Análise completa de pedidos e tags</p>
        </div>
        <Button 
          onClick={activeTab === "orders" ? exportOrdersToCSV : exportTagsToCSV} 
          variant="outline" 
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ClipboardList className="h-4 w-4 inline mr-2" />
          Pedidos
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "tags"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Tag className="h-4 w-4 inline mr-2" />
          Tags
        </button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={handleFilter}>Aplicar Filtros</Button>
            {(dateFrom || dateTo) && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setDateFrom("")
                  setDateTo("")
                  setTimeout(fetchReports, 0)
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============ ABA DE PEDIDOS ============ */}
      {activeTab === "orders" && orderData && (
        <>
          {/* Resumo de Pedidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-indigo-100 mb-2">
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-xl font-bold">{orderData.summary.totalOrders}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-yellow-100 mb-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <p className="text-xs text-gray-500">Em Aberto</p>
                  <p className="text-xl font-bold">{orderData.summary.openOrders}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-green-100 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500">Finalizados</p>
                  <p className="text-xl font-bold">{orderData.summary.finishedOrders}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-gray-100 mb-2">
                    <XCircle className="h-5 w-5 text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-500">Cancelados</p>
                  <p className="text-xl font-bold">{orderData.summary.cancelledOrders}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-green-100 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500">Taxa Conclusão</p>
                  <p className="text-xl font-bold">{orderData.summary.completionRate}%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-red-100 mb-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="text-xs text-gray-500">Taxa Cancelam.</p>
                  <p className="text-xl font-bold">{orderData.summary.cancellationRate}%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 rounded-lg bg-purple-100 mb-2">
                    <Timer className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500">Tempo Médio</p>
                  <p className="text-xl font-bold">
                    {orderData.summary.avgCompletionDays 
                      ? `${orderData.summary.avgCompletionDays}d` 
                      : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribuição por Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Pedidos por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statusLabels).map(([status, label]) => {
                    const count = orderData.byStatus[status] || 0
                    const total = orderData.summary.totalOrders || 1
                    const percentage = Math.round((count / total) * 100)
                    
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-semibold">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: statusColors[status]
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Distribuição por Prioridade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Pedidos por Prioridade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(priorityLabels).map(([priority, label]) => {
                    const count = orderData.byPriority[priority] || 0
                    const total = orderData.summary.totalOrders || 1
                    const percentage = Math.round((count / total) * 100)
                    
                    return (
                      <div key={priority}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-semibold">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: priorityColors[priority]
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evolução Mensal de Pedidos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Evolução Mensal (Últimos 12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orderData.monthlyData && orderData.monthlyData.length > 0 ? (
                <>
                  {/* Gráfico Visual */}
                  <div className="mb-6">
                    <div className="flex items-end gap-2 h-40">
                      {orderData.monthlyData.map((month) => {
                        const maxTotal = Math.max(...orderData.monthlyData.map(m => m.total)) || 1
                        const height = (month.total / maxTotal) * 100
                        
                        return (
                          <div 
                            key={month.month} 
                            className="flex-1 flex flex-col items-center"
                          >
                            <div 
                              className="w-full bg-indigo-500 rounded-t-lg hover:bg-indigo-600 transition-colors relative group"
                              style={{ height: `${height}%`, minHeight: month.total > 0 ? "8px" : "2px" }}
                            >
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-gray-900 dark:bg-gray-800 dark:text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {month.total} pedidos
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{formatMonth(month.month)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tabela */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Mês</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Total</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Finalizados</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Cancelados</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Em Aberto</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Taxa Conclusão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderData.monthlyData.map((month) => {
                          const rate = month.total > 0 
                            ? Math.round((month.finished / month.total) * 100) 
                            : 0
                          return (
                            <tr key={month.month} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium">{formatMonth(month.month)}</td>
                              <td className="py-2 px-3 text-center font-semibold">{month.total}</td>
                              <td className="py-2 px-3 text-center text-green-600">{month.finished}</td>
                              <td className="py-2 px-3 text-center text-gray-500">{month.cancelled}</td>
                              <td className="py-2 px-3 text-center text-blue-600">{month.open}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`font-medium ${
                                  rate >= 70 ? "text-green-600" :
                                  rate >= 40 ? "text-yellow-600" : "text-red-600"
                                }`}>
                                  {rate}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum dado mensal disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags mais usadas nos Pedidos */}
          {tagData && tagData.topTags && tagData.topTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags Mais Usadas nos Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Gráfico de barras */}
                  <div className="space-y-3">
                    {tagData.topTags.slice(0, 8).map((tag, index) => {
                      const maxCount = tagData.topTags[0]?.totalOrders || 1
                      const percentage = (tag.totalOrders / maxCount) * 100
                      
                      return (
                        <div key={tag.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                              <Badge 
                                style={{ backgroundColor: tag.color + "20", color: tag.color }}
                              >
                                {tag.name}
                              </Badge>
                            </div>
                            <span className="text-sm font-semibold">{tag.totalOrders} pedidos</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div
                              className="h-2.5 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: tag.color
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Resumo de conclusão por tag */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Taxa de Conclusão por Tag</h4>
                    {tagData.topTags.slice(0, 8).map((tag) => (
                      <div 
                        key={tag.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: tag.color + "20", color: tag.color }}
                          >
                            {tag.name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {tag.byStatus.FINISHED || 0}/{tag.totalOrders} finalizados
                          </span>
                          <span className={`font-semibold text-sm ${
                            tag.completionRate >= 70 ? "text-green-600" :
                            tag.completionRate >= 40 ? "text-yellow-600" : "text-red-600"
                          }`}>
                            {tag.completionRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ============ ABA DE TAGS ============ */}
      {activeTab === "tags" && tagData && (
        <>
          {/* Resumo de Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-indigo-100">
                    <Tag className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total de Tags Usadas</p>
                    <p className="text-2xl font-bold">{tagData.summary.totalTags || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <BarChart3 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pedidos com Tags</p>
                    <p className="text-2xl font-bold">{tagData.summary.totalOrdersWithTags || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Média Tags/Pedido</p>
                    <p className="text-2xl font-bold">{tagData.summary.avgTagsPerOrder || "0"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Tags - Gráfico de Barras Visual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Tags Mais Usadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tagData.topTags && tagData.topTags.length > 0 ? (
                  <div className="space-y-3">
                    {tagData.topTags.slice(0, 8).map((tag, index) => {
                      const maxCount = tagData.topTags[0]?.totalOrders || 1
                      const percentage = (tag.totalOrders / maxCount) * 100
                      
                      return (
                        <div 
                          key={tag.id} 
                          className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                          onClick={() => setSelectedTag(selectedTag?.id === tag.id ? null : tag)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                              <Badge 
                                style={{ backgroundColor: tag.color + "20", color: tag.color }}
                              >
                                {tag.name}
                              </Badge>
                            </div>
                            <span className="text-sm font-semibold">{tag.totalOrders}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div
                              className="h-2.5 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: tag.color
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nenhuma tag encontrada com pedidos
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detalhes da Tag Selecionada ou Distribuição por Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  {selectedTag ? `Detalhes: ${selectedTag.name}` : "Distribuição por Status"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTag ? (
                  <div className="space-y-6">
                    {/* Taxa de Conclusão */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 mb-2">
                        <span className="text-2xl font-bold text-green-600">
                          {selectedTag.completionRate}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">Taxa de Conclusão</p>
                    </div>

                    {/* Por Status */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Por Status</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedTag.byStatus).map(([status, count]) => (
                          <div key={status} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-xs text-gray-600">
                              {statusLabels[status as keyof typeof statusLabels]}
                            </span>
                            <span className="text-sm font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Por Prioridade */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Por Prioridade</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedTag.byPriority).map(([priority, count]) => (
                          <div key={priority} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-xs text-gray-600">
                              {priorityLabels[priority as keyof typeof priorityLabels]}
                            </span>
                            <span className="text-sm font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => setSelectedTag(null)}
                    >
                      Ver todas as tags
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tagData.topTags && tagData.topTags.length > 0 ? (
                      <>
                        {/* Distribuição geral de status */}
                        {Object.entries(statusLabels).map(([status, label]) => {
                          const total = tagData.topTags.reduce((sum, tag) => 
                            sum + (tag.byStatus[status] || 0), 0
                          )
                          const maxTotal = Math.max(
                            ...Object.keys(statusLabels).map(s => 
                              tagData.topTags.reduce((sum, tag) => sum + (tag.byStatus[s] || 0), 0)
                            )
                          ) || 1

                          return (
                            <div key={status}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">{label}</span>
                                <span className="font-semibold">{total}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${(total / maxTotal) * 100}%`,
                                    backgroundColor: statusColors[status]
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                        <p className="text-xs text-gray-500 mt-4 text-center">
                          Clique em uma tag para ver detalhes
                        </p>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum dado disponível
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Evolução Mensal (Últimos 6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tagData.monthlyStats && tagData.monthlyStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Mês</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Tags Mais Usadas</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tagData.monthlyStats.map((month) => (
                        <tr key={month.month} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium">{formatMonth(month.month)}</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {month.tags.slice(0, 5).map((tag) => (
                                <Badge key={tag.name} variant="outline" className="text-xs">
                                  {tag.name} ({tag.count})
                                </Badge>
                              ))}
                              {month.tags.length > 5 && (
                                <Badge variant="outline" className="text-xs text-gray-400">
                                  +{month.tags.length - 5} mais
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">
                            {month.tags.reduce((sum, t) => sum + t.count, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum dado mensal disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela Completa */}
          <Card>
            <CardHeader>
              <CardTitle>Todas as Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {tagData.allTags && tagData.allTags.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Tag</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Total</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Conclusão</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Em Aberto</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Finalizados</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Cancelados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tagData.allTags.map((tag) => {
                        const emAberto = tag.byStatus.NEW + tag.byStatus.IN_ANALYSIS + 
                                        tag.byStatus.IN_PROGRESS + tag.byStatus.WAITING_CLIENT
                        return (
                          <tr key={tag.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3">
                              <Badge style={{ backgroundColor: tag.color + "20", color: tag.color }}>
                                {tag.name}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold">{tag.totalOrders}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`font-medium ${
                                tag.completionRate >= 70 ? "text-green-600" :
                                tag.completionRate >= 40 ? "text-yellow-600" : "text-red-600"
                              }`}>
                                {tag.completionRate}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-blue-600">{emAberto}</td>
                            <td className="py-3 px-3 text-center text-green-600">{tag.byStatus.FINISHED}</td>
                            <td className="py-3 px-3 text-center text-gray-500">{tag.byStatus.CANCELLED}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma tag encontrada
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
