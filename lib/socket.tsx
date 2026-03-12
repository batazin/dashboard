"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { io, Socket } from "socket.io-client"
import { useSession } from "next-auth/react"

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinOrder: (orderId: string, userId: string) => void
  leaveOrder: (orderId: string) => void
  sendMessage: (orderId: string, message: {
    id: string
    content: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: string
  }, recipientUserId?: string) => void
  startTyping: (orderId: string, userName: string) => void
  stopTyping: (orderId: string, userName: string) => void
  notifyStatusUpdate: (orderId: string, status: string, updatedBy: string, updatedByName: string) => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinOrder: () => {},
  leaveOrder: () => {},
  sendMessage: () => {},
  startTyping: () => {},
  stopTyping: () => {},
  notifyStatusUpdate: () => {},
})

export function useSocket() {
  return useContext(SocketContext)
}

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { data: session } = useSession()
  const [socket, setSocketState] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    console.log("Initializing Socket.IO connection to localhost:3001")

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    // Use http/https schemes (socket.io client accepts http(s) origins).
    const scheme = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http'

    let candidateHosts: string[] = [host]
    // Add common local hostnames as fallbacks so dev env can connect via multiple network interfaces
    candidateHosts.push('localhost', '127.0.0.1', '0.0.0.0', '::1')
    // Deduplicate and keep order
    candidateHosts = Array.from(new Set(candidateHosts)).filter(Boolean)

    let fallbackIndex = 0
    console.log('Socket candidates:', { scheme, candidateHosts })
    console.info('If no socket server is running on port 3001, start it with npm run dev:socket or npm run dev:all')
    let socketInstance: Socket | null = null
    let allHostsFailed = false
    let retryCooldownTimeout: ReturnType<typeof setTimeout> | null = null

    const createSocket = (hostname: string) => {
      const url = `${scheme}://${hostname}:3001`
      console.log('Attempting socket connection to', url)
      const s = io(url, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 2000,
      })

      s.on('connect', () => {
        console.log('Socket connected:', s.id, 'url:', url)
        setIsConnected(true)
        // Note: join-user is now handled in a separate useEffect to handle session loading race conditions
      })

      s.on('disconnect', (reason) => {
        console.log('Socket disconnected', reason)
        setIsConnected(false)
      })

      s.on('connect_error', (error) => {
        try {
          console.error('Socket connect_error:', {
            message: error?.message ?? String(error),
            name: error?.name,
            stack: error?.stack,
            url,
          })
        } catch (e) {
          console.error('Socket connect_error (failed to inspect):', e)
        }

        // Try next fallback host if we have one
        if (fallbackIndex < candidateHosts.length - 1) {
          console.warn('Trying fallback host...')
          try { s.disconnect() } catch (e) {}
          fallbackIndex += 1
          socketInstance = createSocket(candidateHosts[fallbackIndex])
          setSocketState(socketInstance)
        } else {
          console.error('All socket hosts failed; please ensure the socket server is running on port 3001 and network allows connections.')
          try { s.disconnect() } catch (e) {}
          setIsConnected(false)
          setSocketState(null);
          // Additional diagnostic: try to ping the socket server via our own Next API (same-origin)
          (async () => {
            try {
              const pingUrl = '/api/socket/ping'
              const res = await fetch(pingUrl, { method: 'GET', credentials: 'same-origin' })
              const data = await res.json().catch(() => ({}))
              console.info('Socket-server /api/socket/ping check:', { url: pingUrl, ok: res.ok, status: res.status, data })
            } catch (pingErr) {
              console.warn('Socket-server /api/socket/ping failed', pingErr)
            }
          })()
          // Mark all hosts failed; set a cooldown before trying again
          allHostsFailed = true
          if (retryCooldownTimeout) clearTimeout(retryCooldownTimeout)
          retryCooldownTimeout = setTimeout(() => {
            allHostsFailed = false
            fallbackIndex = 0
            socketInstance = createSocket(candidateHosts[fallbackIndex])
            setSocketState(socketInstance)
          }, 15000)
        }
      })

      s.on('error', (error) => {
        console.error('Socket error:', error)
      })

      s.on('reconnect_attempt', (attempt) => {
        console.warn(`Socket reconnect attempt #${attempt}`)
      })
      s.on('reconnect_error', (err) => {
        console.error('Socket reconnect error:', err)
      })
      s.on('reconnect_failed', () => {
        console.error('Socket reconnect failed - disconnecting')
        setIsConnected(false)
        try { s.disconnect() } catch (e) {}
        setSocketState(null);
      })

      return s
    }

    // Check if socket server is reachable via our server-side ping API before opening a websocket
    (async () => {
      try {
        const pingRes = await fetch('/api/socket/ping', { method: 'GET', credentials: 'same-origin' })
        if (!pingRes.ok) {
          console.warn('Socket server ping failed before connect; will not attempt direct websocket until healthy')
          allHostsFailed = true
          if (retryCooldownTimeout) clearTimeout(retryCooldownTimeout)
          retryCooldownTimeout = setTimeout(() => {
            allHostsFailed = false
            fallbackIndex = 0
            socketInstance = createSocket(candidateHosts[fallbackIndex])
            setSocketState(socketInstance)
          }, 15000)
          return
        }
      } catch (e) {
        console.warn('Socket server ping check error before connect:', e)
        allHostsFailed = true
        if (retryCooldownTimeout) clearTimeout(retryCooldownTimeout)
        retryCooldownTimeout = setTimeout(() => {
          allHostsFailed = false
          fallbackIndex = 0
          socketInstance = createSocket(candidateHosts[fallbackIndex])
          setSocketState(socketInstance)
        }, 15000)
        return
      }

      socketInstance = createSocket(candidateHosts[fallbackIndex])
      setSocketState(socketInstance)
    })()

    return () => {
      try { socketInstance?.disconnect() } catch (e) {}
      if (retryCooldownTimeout) clearTimeout(retryCooldownTimeout)
    }
  }, [session?.user?.id])

  // Extra debug: log notification events at the global socket level so we can
  // see if notifications are arriving to the client socket at all.
  useEffect(() => {
    if (!socket) return

    const handleNotif = (data: any) => {
      try {
        console.log('[socket] client received notification event:', data)
      } catch (e) {
        console.warn('[socket] failed to log incoming notification', e)
      }
    }

    socket.on('notification-received', handleNotif)
    socket.on('new-notification', handleNotif)

    return () => {
      socket.off('notification-received', handleNotif)
      socket.off('new-notification', handleNotif)
    }
  }, [socket])

  // Separate effect to join user room - handles race condition where socket connects before session is available
  useEffect(() => {
    if (socket && isConnected && session?.user?.id) {
      socket.emit('join-user', session.user.id)
      console.log('Joined user room:', session.user.id)
    }
  }, [socket, isConnected, session?.user?.id])

  const joinOrder = (orderId: string, userId: string) => {
    if (socket) {
      socket.emit("join-order", orderId, userId)
    }
  }

  const leaveOrder = (orderId: string) => {
    if (socket) {
      socket.emit("leave-order", orderId)
    }
  }

  const sendMessage = (orderId: string, message: {
    id: string
    content: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: string
  }, recipientUserId?: string) => {
    if (socket) {
      socket.emit("send-message", { orderId, message, recipientUserId })
    }
  }

  const startTyping = (orderId: string, userName: string) => {
    if (socket) {
      socket.emit("typing-start", { orderId, userName })
    }
  }

  const stopTyping = (orderId: string, userName: string) => {
    if (socket) {
      socket.emit("typing-stop", { orderId, userName })
    }
  }

  const notifyStatusUpdate = (orderId: string, status: string, updatedBy: string, updatedByName: string) => {
    if (socket) {
      socket.emit("status-updated", { orderId, status, updatedBy, updatedByName })
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinOrder,
        leaveOrder,
        sendMessage,
        startTyping,
        stopTyping,
        notifyStatusUpdate,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}
