"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PendingOrder {
  id: string
  title: string
}

interface PendingConfirmationAlertProps {
  role: string
}

export function PendingConfirmationAlert({ role }: PendingConfirmationAlertProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [open, setOpen] = useState(false)

  const checkPendingOrders = useCallback(async () => {
    if (role !== "REQUESTER") return

    try {
      const response = await fetch(
        "/api/orders?status=WAITING_CONFIRMATION&page=1&limit=50",
        { cache: "no-store" }
      )

      if (!response.ok) return

      const data = await response.json()
      const pendingOrders = (data.orders ?? []).map((order: PendingOrder) => ({
        id: order.id,
        title: order.title,
      }))

      setOrders(pendingOrders)
      setOpen(pendingOrders.length > 0)
    } catch (error) {
      console.error("Erro ao verificar pedidos aguardando confirmação:", error)
    }
  }, [role])

  useEffect(() => {
    if (role !== "REQUESTER") return

    const initialCheck = window.setTimeout(() => {
      checkPendingOrders()
    }, 0)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkPendingOrders()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.clearTimeout(initialCheck)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [checkPendingOrders, role])

  if (role !== "REQUESTER" || orders.length === 0) return null

  const goToOrder = (orderId: string) => {
    setOpen(false)
    router.push(`/orders/${orderId}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-amber-500 sm:max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden="true" />
            <DialogTitle className="text-xl">Pedido aguardando sua confirmação</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {orders.length === 1
              ? "Você tem um pedido que precisa ser verificado e finalizado."
              : `Você tem ${orders.length} pedidos que precisam ser verificados e finalizados.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto py-2">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => goToOrder(order.id)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-accent"
            >
              <span className="min-w-0 truncate font-medium">{order.title}</span>
              <span className="shrink-0 text-sm font-medium text-primary">Ver pedido</span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={() => goToOrder(orders[0].id)} className="gap-2">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Verificar e finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
