"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, Check, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { pusherClient } from "@/lib/pusher"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useNotificationSound } from "@/hooks/use-notification-sound"


interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  silent: boolean
  createdAt: string
  order?: {
    id: string
    title: string
  }
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)
  const notifiedIdsRef = useRef<Set<string>>(new Set())
  const { playSound } = useNotificationSound(true)
  const { data: session } = useSession()
  const { toast } = useToast()

  const CACHE_KEY = 'notifications_cache_v1'

  const saveCache = (notes?: Notification[], unread?: number) => {
    try {
      const payload = {
        notifications: notes ?? notifications,
        unreadCount: typeof unread === 'number' ? unread : unreadCount,
        ts: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
    } catch (e) {
      console.warn('[notifications] failed to save cache', e)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        const notes = data.notifications || []
        setNotifications(notes)
        setUnreadCount(data.unreadCount || 0)
        saveCache(notes, data.unreadCount)
      }
    } catch (err) {
      console.error("Error fetching notifications:", err)
    }
  }

  // Initial load and Pusher Setup
  useEffect(() => {
    if (!session?.user?.id) return

    // Hydrate from cache
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.notifications) {
          setNotifications(parsed.notifications)
          setUnreadCount(parsed.unreadCount || 0)
          parsed.notifications.filter((n: any) => !n.read).forEach((n: any) => notifiedIdsRef.current.add(n.id))
        }
      }
    } catch (e) { }

    fetchNotifications()

    // Subscribe to Pusher
    const channel = pusherClient.subscribe(`user-${session.user.id}`)

    channel.bind("new-notification", (incoming: Notification) => {
      setNotifications((prev) => {
        if (prev.some(n => n.id === incoming.id)) return prev
        const next = [incoming, ...prev].slice(0, 50)
        return next
      })
      setUnreadCount(prev => prev + 1)

      if (!incoming.silent && !notifiedIdsRef.current.has(incoming.id)) {
        playSound()
        setIsPulsing(true)
        setTimeout(() => setIsPulsing(false), 3000)
        notifiedIdsRef.current.add(incoming.id)

        toast({
          title: incoming.title,
          description: incoming.message,
        })
      }
    })

    return () => {
      pusherClient.unsubscribe(`user-${session.user.id}`)
    }
  }, [session?.user?.id])

  // Update document title with unread count
  useEffect(() => {
    if (typeof document === 'undefined') return
    const originalTitle = "Dashboard" // Base title
    if (unreadCount > 0) {
      document.title = `(${unreadCount > 9 ? "9+" : unreadCount}) ${originalTitle}`
    } else {
      document.title = originalTitle
    }
  }, [unreadCount])

  // Persist notifications + unreadCount whenever they change (single source of truth)
  useEffect(() => {
    saveCache()
  }, [notifications, unreadCount])

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ notificationIds: [notificationId] }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        console.error(`Failed to PATCH /api/notifications: ${res.status}`, txt)
        return
      }

      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        return next
      })
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Error marking notification as read (network):", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ markAllRead: true }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        console.error(`Failed to PATCH /api/notifications (markAll): ${res.status}`, txt)
        return
      }

      setNotifications((prev) => {
        const next = prev.map((n) => ({ ...n, read: true }))
        return next
      })
      setUnreadCount(0)
    } catch (error) {
      console.error("Error marking all as read (network):", error)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Agora"
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString("pt-BR")
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("relative transition-all", isPulsing && "ring-2 ring-red-500 scale-110")}>
          <Bell className={cn("h-5 w-5", isPulsing && "animate-bounce text-red-500")} />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full",
              isPulsing && "animate-ping opacity-75"
            )}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {unreadCount > 0 && isPulsing && (
            <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b dark:border-slate-800">
          <span className="font-semibold text-gray-900 dark:text-slate-100">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas lidas
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              Nenhuma notificação
            </div>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start p-3 cursor-pointer focus:bg-accent ${!notification.read ? "bg-blue-50 dark:bg-blue-950/30" : ""
                  }`}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead(notification.id)
                  }
                  if (notification.order) {
                    setOpen(false)
                    router.push(`/orders/${notification.order.id}`)
                  }
                }}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm dark:text-slate-100">{notification.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 bg-blue-500 rounded-full mt-1.5" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>

        {notifications.length > 10 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Link
                href="/notifications"
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline block text-center"
                onClick={() => setOpen(false)}
              >
                Ver todas as notificações
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
