 "use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock, 
  User,
  MessageSquare,
  Paperclip,
  Star,
  History
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { StatusBadge, PriorityBadge } from "@/components/orders/status-badge"
import { FileUpload } from "@/components/orders/file-upload"
import { OrderChat } from "@/components/orders/order-chat"
import { 
  formatDate, 
  statusLabels, 
  priorityLabels,
  formatFileSize,
  professionalStatusLabels,
  professionalStatusColors,
} from "@/lib/utils"

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [showTagsDialog, setShowTagsDialog] = useState(false)
  const [professionalsList, setProfessionalsList] = useState<any[]>([])
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null)
  const [reassignSubstituteNotice, setReassignSubstituteNotice] = useState<string | null>(null)
  const [existingTags, setExistingTags] = useState<any[]>([])
  const [tagQuery, setTagQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const getInitials = (name?: string | null) => {
    if (!name) return "?"
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase()
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
  }

  const [editData, setEditData] = useState({
    status: "",
    statusObservation: "",
  })

  const [finishData, setFinishData] = useState({
    feedback: "",
    rating: 5,
  })

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${id}`)
      if (!response.ok) throw new Error("Pedido não encontrado")
      const data = await response.json()
      setOrder(data)
      setEditData({ status: data.status, statusObservation: "" })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o pedido",
        variant: "destructive",
      })
      router.push("/orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [id])

  useEffect(() => {
    if (!showTagsDialog) return
    let canceled = false
    const load = async () => {
      try {
        const res = await fetch('/api/tags')
        if (!res.ok) throw new Error('Erro ao buscar tags')
        const data = await res.json()
        if (!canceled) setExistingTags(data)
        // preselect order tags
        setSelectedTags(order?.tags?.map((t: any) => t.name) || [])
      } catch (err) {
        console.error('Erro ao carregar tags', err)
      }
    }
    void load()
    return () => { canceled = true }
  }, [showTagsDialog])

  useEffect(() => {
    if (!showReassignDialog) return
    let canceled = false
    const load = async () => {
      try {
        const res = await fetch('/api/professionals')
        if (!res.ok) throw new Error('Erro ao buscar profissionais')
        const data = await res.json()
        // API returns { professionals: [...] } or array
        const list = Array.isArray(data.professionals) ? data.professionals : (Array.isArray(data) ? data : [])
        // Include all professionals (do not exclude the currently assigned one)
        if (!canceled) setProfessionalsList(list)
      } catch (err) {
        console.error('Erro ao carregar profissionais para reatribuição', err)
      }
    }
    void load()
    // preselect current professional when opening dialog
    setSelectedProfessionalId(order?.professional?.id || null)
    return () => { canceled = true }
  }, [showReassignDialog])

  const handleStatusChange = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editData.status,
          statusObservation: editData.statusObservation,
        }),
      })

      if (!response.ok) throw new Error("Erro ao atualizar")

      const updated = await response.json()
      setOrder(updated)
      setShowEditDialog(false)
      
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleFinish = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finishData),
      })

      if (!response.ok) throw new Error("Erro ao finalizar")

      const updated = await response.json()
      setOrder(updated)
      setShowFinishDialog(false)
      
      toast({
        title: "Pedido Finalizado!",
        description: "O pedido foi marcado como finalizado",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível finalizar o pedido",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Erro ao excluir")

      toast({
        title: "Pedido Excluído",
        description: "O pedido foi excluído com sucesso",
      })
      
      router.push("/orders")
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o pedido",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleAttachmentUpload = (attachment: any) => {
    setOrder((prev: any) => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }))
  }

  const handleAttachmentRemove = (attachmentId: string) => {
    setOrder((prev: any) => ({
      ...prev,
      attachments: prev.attachments.filter((a: any) => a.id !== attachmentId),
    }))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  const canEdit = 
    session?.user?.role === "ADMIN" ||
    order.requesterId === session?.user?.id ||
    order.professional?.userId === session?.user?.id

  const canFinish = canEdit && order.status !== "FINISHED" && order.status !== "CANCELLED"

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/orders" className="inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para pedidos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.title}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
          
          {canEdit && (
            <>
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Edit className="h-4 w-4" />
                    Alterar Status
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Alterar Status</DialogTitle>
                    <DialogDescription>
                      Selecione o novo status e adicione uma observação (opcional)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Novo Status</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData((prev) => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                          {reassignSubstituteNotice && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{reassignSubstituteNotice}</p>
                          )}
                    </div>
                    <div className="space-y-2">
                      <Label>Observação</Label>
                      <Textarea
                        value={editData.statusObservation}
                        onChange={(e) => setEditData((prev) => ({ ...prev, statusObservation: e.target.value }))}
                        placeholder="Adicione uma observação sobre a mudança..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleStatusChange} disabled={updating}>
                      {updating ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {canFinish && (
                <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Finalizar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Finalizar Pedido</DialogTitle>
                      <DialogDescription>
                        Adicione um feedback e avaliação para o pedido
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Avaliação</Label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFinishData((prev) => ({ ...prev, rating: star }))}
                              className="p-1"
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  star <= finishData.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Feedback</Label>
                        <Textarea
                          value={finishData.feedback}
                          onChange={(e) => setFinishData((prev) => ({ ...prev, feedback: e.target.value }))}
                          placeholder="Adicione um feedback sobre o pedido..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowFinishDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleFinish} disabled={updating}>
                        {updating ? "Finalizando..." : "Finalizar Pedido"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {session?.user?.role === "ADMIN" && (
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1">
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Excluir Pedido</DialogTitle>
                      <DialogDescription>
                        Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                        Cancelar
                      </Button>
                      <Button variant="destructive" onClick={handleDelete} disabled={updating}>
                        {updating ? "Excluindo..." : "Excluir"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="whitespace-pre-wrap">{order.description}</p>

                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tags</p>
                  </div>
                  {canEdit && (
                    <div>
                      <Dialog open={showTagsDialog} onOpenChange={setShowTagsDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">Editar Tags</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Tags</DialogTitle>
                            <DialogDescription>Adicione ou remova tags deste pedido</DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <input
                                aria-label="Procurar tags"
                                value={tagQuery}
                                onChange={(e) => setTagQuery(e.target.value)}
                                placeholder="Procurar tags..."
                                className="text-sm px-2 py-1 border rounded-md w-full"
                              />
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-48 overflow-auto">
                              {existingTags
                                .filter((t) => t.name.toLowerCase().includes(tagQuery.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((tag) => {
                                  const active = selectedTags.includes(tag.name)
                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() => {
                                        if (active) setSelectedTags((s) => s.filter((x) => x !== tag.name))
                                        else setSelectedTags((s) => [...s, tag.name])
                                      }}
                                      className={`px-3 py-1 text-sm rounded-full font-medium transition-colors ${active ? 'ring-2 ring-offset-1' : ''}`}
                                      style={{ backgroundColor: tag.color + (active ? '40' : '20'), color: tag.color }}
                                    >
                                      {active ? '✓ ' : '+ '}{tag.name}
                                    </button>
                                  )
                                })}
                            </div>
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowTagsDialog(false)}>Cancelar</Button>
                            <Button onClick={async () => {
                              setUpdating(true)
                              try {
                                const res = await fetch(`/api/orders/${id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ tags: selectedTags })
                                })
                                if (!res.ok) throw new Error('Falha ao salvar tags')
                                const updated = await res.json()
                                setOrder(updated)
                                setShowTagsDialog(false)
                                toast({ title: 'Tags atualizadas', variant: 'success' })
                              } catch (err) {
                                console.error(err)
                                toast({ title: 'Erro', description: 'Não foi possível atualizar tags', variant: 'destructive' })
                              } finally {
                                setUpdating(false)
                              }
                            }}>Salvar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>

                {order.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {order.tags.map((tag: any) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded-full"
                        style={{ backgroundColor: tag.color + "20", color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Chat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderChat
                orderId={order.id}
                initialMessages={order.messages}
                recipientUserId={
                  session?.user?.id === order.requesterId
                    ? order.professional?.userId
                    : order.requesterId
                }
              />
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Anexos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                orderId={order.id}
                existingAttachments={order.attachments}
                onUploadComplete={handleAttachmentUpload}
                onRemove={handleAttachmentRemove}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Solicitante</p>
                  <p className="font-medium">{order.requester.name || "Usuário"}</p>
                </div>
              </div>

              {order.professional && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Profissional</p>
                    <p className="font-medium">{order.professional.user.name}</p>
                  </div>
                </div>
              )}

              {/* Allow assigned professional to reassign to another professional */}
              {session?.user?.role === "PROFESSIONAL" && order.professional?.userId === session.user.id && (
                <div className="mt-2">
                  <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Reatribuir</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reatribuir Profissional</DialogTitle>
                        <DialogDescription>Selecione outro profissional para assumir este pedido.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Profissional</Label>
                          <Select value={selectedProfessionalId || ""} onValueChange={async (v) => {
                            setReassignSubstituteNotice(null)
                            // if empty string, clear
                            if (!v) { setSelectedProfessionalId(null); return }
                            try {
                              const res = await fetch(`/api/professionals/${v}`)
                              if (!res.ok) throw new Error('Erro ao buscar profissional')
                              const prof = await res.json()
                              const now = new Date()
                              const substituteId = prof.substituteProfessionalId ?? null
                              const substituteUntil = prof.substituteUntil ? new Date(prof.substituteUntil) : null
                              const substituteActive = Boolean(substituteId && (!substituteUntil || substituteUntil > now))
                              if (prof.status === 'UNAVAILABLE' && substituteActive && substituteId) {
                                // try find substitute in list
                                let substitute = professionalsList.find(p => p.id === substituteId)
                                if (!substitute) {
                                  const r2 = await fetch(`/api/professionals/${substituteId}`)
                                  if (r2.ok) substitute = await r2.json()
                                }
                                if (substitute) {
                                  setSelectedProfessionalId(substitute.id)
                                  const untilText = substituteUntil ? ` até ${new Date(substituteUntil).toLocaleString()}` : ''
                                  const notice = `O profissional ${prof.user?.name || prof.user?.email || prof.id} está indisponível${untilText}. Atribuindo ${substitute.user?.name || substitute.user?.email || substitute.id} automaticamente.`
                                  setReassignSubstituteNotice(notice)
                                  toast({ title: 'Profissional indisponível', description: notice })
                                  return
                                }
                                // no substitute found
                                setSelectedProfessionalId(null)
                                const notice = `O profissional ${prof.user?.name || prof.user?.email || prof.id} está indisponível e o substituto não foi encontrado.`
                                setReassignSubstituteNotice(notice)
                                toast({ title: 'Substituto não encontrado', description: notice, variant: 'destructive' })
                                return
                              }
                              // normal case
                              setSelectedProfessionalId(v)
                            } catch (err) {
                              console.error('Erro ao processar seleção de profissional', err)
                              toast({ title: 'Erro', description: 'Não foi possível verificar o profissional selecionado', variant: 'destructive' })
                              setSelectedProfessionalId(v)
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {professionalsList.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {getInitials(p.user?.name || p.user?.email || p.id)}
                                      </div>
                                      <div className="text-left">
                                        <div className="font-medium text-sm">{p.user?.name || p.user?.email || p.id}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{p.specialty || "-"}</div>
                                      </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${(professionalStatusColors as any)[p.status as any] || 'bg-gray-100 text-gray-800'}`}>
                                      {p.status ? ((professionalStatusLabels as any)[p.status as any] || p.status) : ""}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReassignDialog(false)}>Cancelar</Button>
                        <Button onClick={async () => {
                          if (!selectedProfessionalId) return
                          setUpdating(true)
                          try {
                            const res = await fetch(`/api/orders/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ professionalId: selectedProfessionalId })
                            })
                            if (!res.ok) throw new Error('Falha ao reatribuir')
                            const updated = await res.json()
                            setOrder(updated)
                            setShowReassignDialog(false)
                          } catch (err) {
                            toast({ title: 'Erro', description: 'Não foi possível reatribuir', variant: 'destructive' })
                          } finally {
                            setUpdating(false)
                          }
                        }}>Reatribuir</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Criado em</p>
                  <p className="font-medium">{formatDate(order.createdAt)}</p>
                </div>
              </div>

              {order.finishedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Finalizado em</p>
                    <p className="font-medium">{formatDate(order.finishedAt)}</p>
                  </div>
                </div>
              )}

              {order.rating && (
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avaliação</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= order.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {order.feedback && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Feedback</p>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{order.feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.statusHistory.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum histórico</p>
              ) : (
                <div className="space-y-4">
                  {order.statusHistory.map((history: any) => (
                    <div key={history.id} className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-center gap-2">
                        {history.fromStatus && (
                          <>
                            <StatusBadge status={history.fromStatus} className="text-xs" />
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <StatusBadge status={history.toStatus} className="text-xs" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {history.changedBy.name} • {formatDate(history.createdAt)}
                      </p>
                      {history.observation && (
                        <p className="text-sm text-gray-600 mt-1">{history.observation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
