"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Send, Image as ImageIcon, Loader2, X } from "lucide-react"
import { pusherClient } from "@/lib/pusher"
import { formatDate, isValidFileType, isValidFileSize, MAX_FILE_SIZE, formatFileSize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

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
  const [isDragging, setIsDragging] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(initialMessages.length)
  const isFirstLoadRef = useRef(true)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Só faz scroll quando há novas mensagens
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
      prevMessagesLengthRef.current = messages.length
      return
    }

    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom()
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  // Setup Pusher Realtime
  useEffect(() => {
    const channel = pusherClient.subscribe(`order-${orderId}`)

    channel.bind("new-message", (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    // Initial fetch to make sure we didn't miss anything before sub
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/messages`)
        if (response.ok) {
          const data: Message[] = await response.json()
          const unique = Array.from(new Map(data.map(m => [m.id, m])).values())
          setMessages(unique)
        }
      } catch (err) {
        console.error("Error fetching initial messages:", err)
      }
    }
    fetchMessages()

    return () => {
      pusherClient.unsubscribe(`order-${orderId}`)
    }
  }, [orderId])

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Tipo de arquivo não permitido. Apenas imagens são aceitas aqui.",
        variant: "destructive",
      })
      return
    }

    if (!isValidFileSize(file.size)) {
      toast({
        title: "Erro",
        description: `Arquivo muito grande. Máximo: ${formatFileSize(MAX_FILE_SIZE)}`,
        variant: "destructive",
      })
      return
    }

    setSending(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("orderId", orderId)

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const attachment = await response.json()
        await sendMessageInternal(`![image](${attachment.url})`)
      } else {
        const data = await response.json()
        toast({
          title: "Erro no upload",
          description: data.error || "Não foi possível enviar a imagem",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error uploading image:", err)
      toast({
        title: "Erro",
        description: "Erro interno ao enviar imagem",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          uploadImage(file)
        }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length > 0) {
      imageFiles.forEach(file => uploadImage(file))
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || sending) return

    const content = newMessage
    setNewMessage("")
    await sendMessageInternal(content)
  }

  const sendMessageInternal = async (content: string) => {
    setSending(true)

    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const message = await response.json()
        // Add the created message locally (dedup by id)
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })

      }
    } catch (error) {

      console.error("Error sending message:", error)
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      })
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
    <div
      className={`flex flex-col h-[400px] border rounded-lg transition-colors relative ${isDragging ? "border-indigo-500 bg-indigo-50/10" : "border-gray-200"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-50/50 rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-lg border border-indigo-100">
            <ImageIcon className="h-10 w-10 text-indigo-500 animate-bounce" />
            <p className="font-semibold text-indigo-700">Solte para enviar a imagem</p>
          </div>
        </div>
      )}
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
                    className={`inline-block px-4 py-2 rounded-lg ${isOwn
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-900"
                      }`}
                  >
                    {message.content.startsWith('![image](') ? (
                      <div className="space-y-1">
                        <img
                          src={message.content.match(/!\[image\]\((.*?)\)/)?.[1]}
                          alt="Enviada no chat"
                          className="max-w-full max-h-[300px] rounded-md cursor-pointer hover:opacity-95 transition-opacity bg-white"
                          onClick={() => setPreviewImage(message.content.match(/!\[image\]\((.*?)\)/)?.[1] || null)}
                        />
                        <p className="text-[10px] opacity-70 text-right italic">Clique para ampliar</p>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
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
            onPaste={handlePaste}
            placeholder="Digite sua mensagem (Arraste ou cole imagens aqui)..."
            disabled={sending}
            className="min-h-[40px] max-h-[120px] resize-none py-2"
            rows={1}
          />
          <Button type="submit" disabled={(!newMessage.trim() && !sending) || sending} className="h-10">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      {/* Imagem Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 transition-all animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-screen flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl scale-in-95 animate-in duration-200 bg-white"
            />
            <button
              className="absolute -top-10 right-0 md:-right-10 text-white hover:text-gray-300 transition-colors p-2"
              onClick={() => setPreviewImage(null)}
              aria-label="Fechar"
            >
              <X className="h-8 w-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
