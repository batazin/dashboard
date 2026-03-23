"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Send } from "lucide-react"
import { useSocket } from "@/lib/socket"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Message {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface OrderChatProps {
  orderId: string
  initialMessages?: Message[]
  recipientUserId?: string | null
}

export function OrderChat({ orderId, initialMessages = [], recipientUserId = null }: OrderChatProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const POLL_INTERVAL_MS = 3000
  const POLL_STOP_AFTER_MS = 10 * 60 * 1000 // stop polling after 10 minutes by default
  const prevMessagesLengthRef = useRef(initialMessages.length)
  const isFirstLoadRef = useRef(true)
  const { socket, isConnected, joinOrder, leaveOrder, sendMessage: sendSocketMessage } = useSocket()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Só faz scroll quando há novas mensagens (não no polling inicial)
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
      prevMessagesLengthRef.current = messages.length
      return
    }
    
    // Só scroll se houver mais mensagens que antes
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom()
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  // Polling for new messages (simple realtime solution)
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/messages`)
        if (response.ok) {
          const data: Message[] = await response.json()
          // Ensure we keep unique messages by id to avoid UI duplicates
          const unique = Array.from(new Map(data.map(m => [m.id, m])).values())
          setMessages(unique)
        }
      } catch (error) {
        console.error("Error fetching messages:", error)
      }
    }

    // Poll every POLL_INTERVAL_MS
    if (!pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS)
    }

    // Stop polling after a set timeout to avoid long-lived polling
    if (!pollStopTimeoutRef.current) {
      pollStopTimeoutRef.current = setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
          console.log(`Stopped polling for order ${orderId} after ${POLL_STOP_AFTER_MS}ms`)
        }
      }, POLL_STOP_AFTER_MS)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (pollStopTimeoutRef.current) {
        clearTimeout(pollStopTimeoutRef.current)
        pollStopTimeoutRef.current = null
      }
    }
  }, [orderId])

  // If the socket connects, we can stop polling early and rely on realtime messages
  useEffect(() => {
    if (isConnected && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
      if (pollStopTimeoutRef.current) {
        clearTimeout(pollStopTimeoutRef.current)
        pollStopTimeoutRef.current = null
      }
      console.log(`Socket connected; stopped polling for order ${orderId}`)
    }
    // If socket disconnects and polling was previously stopped, restart polling for a short period
    if (!isConnected && !pollIntervalRef.current) {
      // start polling again for a limited time to keep UI reasonably up-to-date
      pollIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/orders/${orderId}/messages`)
          if (response.ok) setMessages(await response.json())
        } catch (err) {
          console.error('Error fetching messages in reconnect polling', err)
        }
      }, POLL_INTERVAL_MS)

      if (!pollStopTimeoutRef.current) {
        pollStopTimeoutRef.current = setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
            console.log(`Stopped reconnect polling for order ${orderId} after ${POLL_STOP_AFTER_MS}ms`)
          }
        }, POLL_STOP_AFTER_MS)
      }
    }
  }, [isConnected, orderId])

  // Join the order room via socket to receive realtime messages/typing
  useEffect(() => {
    if (!isConnected || !socket) return
    if (!session?.user?.id) return
    joinOrder(orderId, session.user.id)
    console.log('Joined order room via socket:', orderId, session.user.id)
    const handleNewMessage = (msg: any) => {
      // Avoid duplicates
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    socket.on('new-message', handleNewMessage)

    return () => {
      socket.off('new-message', handleNewMessage)
      leaveOrder(orderId)
    }
  }, [socket, isConnected, session?.user?.id, joinOrder, leaveOrder, orderId])

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)

    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      })

      if (response.ok) {
        const message = await response.json()
        // Add the created message locally (dedup by id)
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        setNewMessage("")
        // Emit a lightweight notification event to the socket-server so the
        // recipient receives an immediate notification even if the server
        // side /emit-notification call is delayed or fails. We emit
        // 'new-notification' (server handles broadcasting) — this does NOT
        // broadcast 'new-message' so it won't cause duplicate messages.
        try {
          if (socket && recipientUserId) {
            const payload = {
              userId: recipientUserId,
              notification: {
                type: 'NEW_MESSAGE',
                title: 'Nova mensagem',
                message: message.content,
                orderId,
                createdAt: message.createdAt,
                actorId: session?.user?.id || null,
              },
            }
            console.log('[order-chat] Emitting new-notification via socket', payload)
            socket.emit('new-notification', payload)
          } else {
            console.log('[order-chat] Skipping new-notification emit - no socket or recipientUserId', { socket: !!socket, recipientUserId })
          }
        } catch (err) {
          console.warn('[order-chat] Failed to emit new-notification via socket', err)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-lg">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Nenhuma mensagem ainda. Inicie a conversa!
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.user.id === session?.user?.id
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.user.image || undefined} />
                  <AvatarFallback>
                    {message.user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {isOwn ? "Você" : message.user.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                  <div
                    className={`inline-block px-4 py-2 rounded-lg ${
                      isOwn
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => handleSendMessage(e)} className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem (Enter para enviar, Shift+Enter para pular linha)..."
            disabled={sending}
            className="min-h-[40px] max-h-[120px] resize-none py-2"
            rows={1}
          />
          <Button type="submit" disabled={!newMessage.trim() || sending} className="h-10">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
