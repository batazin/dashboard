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
import { useNotificationSound } from "@/hooks/use-notification-sound"
import { useSocket } from "@/lib/socket"
import { useSession } from "next-auth/react"

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
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0)
  const [serverReachable, setServerReachable] = useState(true)
  const { playSound } = useNotificationSound(true) // Habilitar som por padrão
  const { data: session } = useSession()
  const { socket, isConnected } = useSocket()
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inProgressRef = useRef(false)
  const consecutiveFailsRef = useRef(0)
  const pollIntervalMsRef = useRef(5000)
  const POLL_MIN_MS = 3000
  const POLL_MAX_MS = 60000
  const POLL_BACKOFF_FACTOR = 2
  const pollStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const POLL_STOP_AFTER_MS = 10 * 60 * 1000
  const CACHE_KEY = 'notifications_cache_v1'
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

  const saveCache = (notes?: Notification[], unread?: number) => {
    try {
      const payload = { notifications: notes ?? notifications, unreadCount: typeof unread === 'number' ? unread : unreadCount, ts: Date.now() }
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
      console.log('[notifications] cache saved (saveCache) length:', (payload.notifications || []).length, 'unread:', payload.unreadCount)
    } catch (e) {
      console.warn('[notifications] failed to save cache', e)
    }
  }

  const fetchNotifications = async (signal?: AbortSignal) => {
    try {
      const apiUrl = new URL('/api/notifications', window.location.origin).href
      // Debugging info to help diagnose malformed URLs reported in browser
      try {
        console.log("[notifications] window.location.href:", window.location.href)
        console.log("[notifications] window.location.origin:", window.location.origin)
        console.log("[notifications] document.baseURI:", document.baseURI)
        let base = document.querySelector('base')?.getAttribute('href') || document.baseURI
        // If base contains duplicated host segments, ignore it in favor of window.location.origin
        if (/(localhost:3000\/localhost:3000)|(127\.0\.0\.1:3000\/127\.0\.0\.1:3000)/.test(base)) {
          console.warn('[notifications] Corrupted base detected; ignoring base and using window.location.origin for fetch')
          base = window.location.origin
        }
        console.log("[notifications] base tag href:", base)
        const resolved = new URL(apiUrl, base || window.location.href).href
        console.log("[notifications] resolved absolute URL:", resolved)
        if (resolved.includes('localhost:3000/localhost:3000')) {
          console.error("[notifications] Resolved URL looks malformed, aborting fetch:", resolved)
          return
        }
      } catch (err) {
        console.warn("[notifications] Error while resolving URL for debug:", err)
      }
      console.log("Fetching notifications from:", apiUrl)
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        redirect: 'manual' as RequestRedirect,
        signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        console.error(
          `Failed to fetch /api/notifications: ${response.status} ${response.statusText}`,
          text
        )
        throw new Error(`Fetch failed with status ${response.status}`)
      }

      // If the server returned a redirect (e.g., 308), don't follow endlessly
      if (response.status >= 300 && response.status < 400) {
        console.warn('[notifications] Server responded with a redirect; aborting fetch to avoid loops', response.status, response.headers.get('location'))
        return
      }

      // If server returned HTML (dev error page / not-found), log it for debugging
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        const text = await response.text().catch(() => '')
        console.error('[notifications] Received HTML response for API call', { status: response.status, text: (text || '').slice(0, 1024) })
        throw new Error('Server returned HTML for /api/notifications')
      }

      const data = await response.json()

      // Merge server notifications with local cache to preserve user's local read state
      const serverNotes: Notification[] = Array.isArray(data.notifications) ? data.notifications : []
      let localCache: any = null
      try {
        const rawLocal = localStorage.getItem(CACHE_KEY)
        if (rawLocal) localCache = JSON.parse(rawLocal)
      } catch (e) {
        localCache = null
      }
      const localNotes: Notification[] = Array.isArray(localCache?.notifications) ? localCache.notifications : []

      const fallbackKey = (n: any) => `${n.message || ''}::${n.createdAt || ''}::${n.order?.id || ''}`
      const localById = new Map<string, Notification>()
      const localByFallback = new Map<string, Notification>()
      localNotes.forEach((n) => {
        if (n && n.id) localById.set(n.id, n)
        localByFallback.set(fallbackKey(n), n)
      })

      const mergedMap: Notification[] = serverNotes.map((s) => {
        const local = (s.id && localById.get(s.id)) || localByFallback.get(fallbackKey(s))
        const read = local ? !!local.read : !!s.read
        const silent = s.silent ?? false
        return { ...s, read, silent }
      })

      // Include any local-only notifications (e.g., tmp ids from socket) not present on server
      localNotes.forEach((ln) => {
        if (!mergedMap.some((m: Notification) => m.id === ln.id)) {
          mergedMap.push(ln)
        }
      })

      // Sort by createdAt desc
      mergedMap.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const finalList = mergedMap.slice(0, 50)
      setNotifications(finalList)
      const newUnread = finalList.filter((n) => !n.read).length
      setUnreadCount(newUnread)
      try { saveCache(finalList, newUnread) } catch (e) { }

      // Play sound if new unread increased and at least one new notification is not silent
      if (newUnread > previousUnreadCount) {
        const newOnes = finalList.filter(n => !n.read).slice(0, newUnread - previousUnreadCount)
        if (newOnes.some(n => !n.silent)) playSound()
      }
      setPreviousUnreadCount(newUnread)
    } catch (error: any) {
      // Abort is expected on timeout; treat separately
      if (error?.name === 'AbortError') {
        // Silently return on abort
        return
      }
      // For network-level failures, avoid spamming console: warn only
      if (error?.message?.includes?.('Failed to fetch')) {
        console.warn('Network fetch failed for /api/notifications (likely server unreachable):', error?.message)
        throw error
      }
      console.error("Error fetching notifications (network error):", error)
      throw error
    }
  }

  useEffect(() => {
    // Hydrate from cache to keep notifications visible across F5 reloads
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      console.log('[notifications] reading cache key:', CACHE_KEY, 'raw:', raw ? raw.slice(0, 200) : null)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed) {
          if (parsed.ts && (Date.now() - parsed.ts) < CACHE_TTL_MS) {
            console.log('[notifications] cache hydrated (within TTL) length:', (parsed.notifications || []).length, 'unread:', parsed.unreadCount)
            setNotifications(parsed.notifications || [])
            setUnreadCount(parsed.unreadCount || 0)
          } else {
            console.log('[notifications] cache present but expired or missing ts; hydrating anyway for UX', parsed)
            // still hydrate for UX (in case server is unavailable)
            setNotifications(parsed.notifications || [])
            setUnreadCount(parsed.unreadCount || 0)
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
    // Ensure cache saved on unload/visibility changes
    const onVisibility = () => saveCache()
    const onBeforeUnload = () => saveCache()
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    let mounted = true
    const scheduleNext = (ms: number) => {
      if (!mounted) return
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = setTimeout(() => {
        void doPoll()
      }, ms)
    }

    const doPoll = async () => {
      if (!mounted) return
      if (inProgressRef.current) return
      inProgressRef.current = true
      const abort = new AbortController()
      const abortTimeout = setTimeout(() => abort.abort(), 8000)
      try {
        await fetchNotifications(abort.signal)
        consecutiveFailsRef.current = 0
        pollIntervalMsRef.current = 5000
      } catch (err: any) {
        consecutiveFailsRef.current += 1
        // Exponential backoff on repeated failures
        pollIntervalMsRef.current = Math.min(POLL_MAX_MS, Math.max(POLL_MIN_MS, pollIntervalMsRef.current * POLL_BACKOFF_FACTOR))
        if (consecutiveFailsRef.current === 1) {
          console.warn('[notifications] Polling error (first failure):', err?.message || err)
        } else if (consecutiveFailsRef.current % 5 === 0) {
          // Periodic summary to avoid spamming console
          console.warn(`[notifications] Polling still failing; consecutive failures: ${consecutiveFailsRef.current}`)
        }
      } finally {
        clearTimeout(abortTimeout)
        inProgressRef.current = false
      }
      scheduleNext(pollIntervalMsRef.current)
    }

    // Start looping
    scheduleNext(pollIntervalMsRef.current)

    return () => {
      mounted = false
      // On success, ensure serverReachable true
      if (!serverReachable) setServerReachable(true)
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
      // Clear any leftover stop-timeout when unmounting
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  // Listen for real-time notifications via socket
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleNewNotification = (notificationData: any) => {
      console.log("[notification-bell] Nova notificação recebida via socket:", notificationData)

      // If socket sent the notification payload directly, add it immediately
      // to the UI to show the badge without waiting for the polling fetch.
      try {
        const incoming = notificationData?.notification ? notificationData.notification : notificationData
        console.log('[notification-bell] parsed incoming notification:', incoming)
        if (!incoming) return

        // Ignore notifications generated by this same user (actor)
        if (incoming.actorId && session?.user?.id && incoming.actorId === session.user.id) {
          console.log('[notification-bell] Ignoring notification created by current user (actorId match)')
          return
        }

        // Insert into state (cache persistence is centralized below)
        setNotifications((prev) => {
          const derivedId = incoming.id || `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          if (prev.some((n) => n.id === derivedId || (n.message === (incoming.message || incoming.text) && n.createdAt === (incoming.createdAt || incoming.createdAt)))) return prev
          const shaped = {
            id: derivedId,
            type: incoming.type || 'INFO',
            title: incoming.title || 'Notificação',
            message: incoming.message || incoming.text || '',
            read: !!incoming.read,
            silent: !!incoming.silent,
            createdAt: incoming.createdAt || new Date().toISOString(),
            order: incoming.order ? { id: incoming.order.id, title: incoming.order.title } : incoming.orderId ? { id: incoming.orderId, title: '' } : undefined,
          } as Notification
          const next = [shaped, ...prev].slice(0, 50)
          return next
        })

        // increment unread unless notification explicitly marked read
        setUnreadCount((prev) => {
          const inc = incoming.read ? 0 : 1
          return prev + inc
        })

        // Play notification sound unless it's silent
        if (!incoming.silent) playSound()
      } catch (err) {
        console.warn('[notifications] failed to insert incoming notification into state', err)
      }
    }

    console.log('[notifications] Subscribing to socket notification events')
    // Listen for both events (backward compatibility)
    socket.on("notification-received", handleNewNotification)
    socket.on("new-notification", handleNewNotification)

    return () => {
      console.log('[notifications] Unsubscribing from socket notification events')
      socket.off("notification-received", handleNewNotification)
      socket.off("new-notification", handleNewNotification)
    }
  }, [socket, isConnected])

  // Stop polling when socket connects; resume polling behavior after disconnect
  useEffect(() => {
    if (isConnected) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
      // Mark server as reachable when socket connects
      setServerReachable(true)
      consecutiveFailsRef.current = 0
      pollIntervalMsRef.current = 5000
      if (pollStopTimeoutRef.current) {
        clearTimeout(pollStopTimeoutRef.current)
        pollStopTimeoutRef.current = null
      }
      console.log('[notifications] Socket connected; resetting polling backoff')
    }
  }, [isConnected])

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
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
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
