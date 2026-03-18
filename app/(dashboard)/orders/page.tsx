"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Filter, Plus, X, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge, PriorityBadge } from "@/components/orders/status-badge"
import { formatDate, statusLabels, priorityLabels } from "@/lib/utils"

interface Order {
  id: string
  title: string
  description: string
  pageUrl?: string | null
  status: string
  priority: string
  createdAt: string
  requester: { name: string | null }
  professional: { user: { name: string | null } } | null
  tags: { id: string; name: string; color: string }[]
  _count: { messages: number }
}

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [view, setView] = useState<"pending" | "all" | "history">(
    "pending"
  )
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "all")
  const [priority, setPriority] = useState(searchParams.get("priority") || "all")
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  const fetchOrders = async () => {
    setLoading(true)
    const params = new URLSearchParams()

    if (search) params.set("search", search)
    // If the user chose the 'Histórico' view, force status=FINISHED on the API
    if (view === "history") {
      params.set("status", "FINISHED")
    } else if (status && status !== "all") {
      params.set("status", status)
    }
    if (priority && priority !== "all") params.set("priority", priority)
    params.set("page", pagination.page.toString())
    params.set("limit", pagination.limit.toString())

    try {
      const response = await fetch(`/api/orders?${params}`)
      const data = await response.json()
      let fetched: Order[] = data.orders || []

      // For pending view, exclude FINISHED and CANCELLED locally
      if (view === "pending") {
        fetched = fetched.filter((o: Order) => o.status !== "FINISHED" && o.status !== "CANCELLED")
      }

      setOrders(fetched)
      setPagination(data.pagination || pagination)
    } catch (error) {
      console.error("Error fetching orders:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [status, priority, pagination.page])

  // Re-fetch when view changes (switching tabs)
  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }))
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    fetchOrders()
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPriority("all")
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pedidos</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {view === "all" ? (
              <>{pagination.total} pedido{pagination.total !== 1 ? "s" : ""} encontrado{pagination.total !== 1 ? "s" : ""}</>
            ) : (
              <>{orders.length} pedido{orders.length !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        <Link href="/orders/new">
          <Button className="gap-2 border border-gray-900 hover:bg-gray-900 hover:text-white">
            <Plus className="h-4 w-4" />
            Novo Pedido
          </Button>
        </Link>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded-md text-sm ${view === "pending" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
          onClick={() => setView("pending")}
        >
          Pendentes
        </button>
        <button
          className={`px-3 py-1 rounded-md text-sm ${view === "all" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
          onClick={() => setView("all")}
        >
          Todos
        </button>
        <button
          className={`px-3 py-1 rounded-md text-sm ${view === "history" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
          onClick={() => setView("history")}
        >
          Histórico
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pedidos..."
                  className="pl-10"
                />
              </div>
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas prioridades</SelectItem>
                  {Object.entries(priorityLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(search || status !== "all" || priority !== "all") && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Carregando...</p>
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">Nenhum pedido encontrado.</p>
              <Link href="/orders/new">
                <Button className="mt-4">Criar Pedido</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg truncate">{order.title}</h3>
                        {order.pageUrl && (
                          <ExternalLink className="h-4 w-4 text-indigo-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mt-1">
                        {order.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>Por: {order.requester.name || "Usuário"}</span>
                        {order.professional && (
                          <>
                            <span>•</span>
                            <span>Atribuído: {order.professional.user.name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDate(order.createdAt)}</span>
                        {order._count.messages > 0 && (
                          <>
                            <span>•</span>
                            <span>{order._count.messages} mensagem(s)</span>
                          </>
                        )}
                      </div>
                      {order.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {order.tags.map((tag) => (
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
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={order.status} />
                      <PriorityBadge priority={order.priority} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
