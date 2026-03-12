"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowLeft, Edit, Save, X, Mail, Briefcase, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge, PriorityBadge } from "@/components/orders/status-badge"
import { 
  formatDate, 
  professionalStatusLabels, 
  professionalStatusColors 
} from "@/lib/utils"

interface ProfessionalDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ProfessionalDetailPage({ params }: ProfessionalDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()

  const [professional, setProfessional] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [editData, setEditData] = useState({
    specialty: "",
    status: "",
    bio: "",
    skills: [] as string[],
    substituteProfessionalId: null as string | null,
    substituteUntil: null as string | null,
  })
  const [newSkill, setNewSkill] = useState("")
  const [allProfessionals, setAllProfessionals] = useState<any[]>([])

  const fetchProfessional = async () => {
    try {
      const response = await fetch(`/api/professionals/${id}`)
      if (!response.ok) throw new Error("Profissional não encontrado")
      const data = await response.json()
      setProfessional(data)
      setEditData({
        specialty: data.specialty,
        status: data.status,
        bio: data.bio || "",
        skills: data.skills,
        substituteProfessionalId: data.substituteProfessionalId || null,
        substituteUntil: data.substituteUntil ? new Date(data.substituteUntil).toISOString().slice(0,16) : null,
      })
      // fetch list of professionals for substitute selection
      try {
        const listRes = await fetch('/api/professionals')
        if (listRes.ok) {
          const listData = await listRes.json()
          const list = listData.professionals || listData || []
          setAllProfessionals(Array.isArray(list) ? list : [])
        }
      } catch (e) {
        // ignore
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o profissional",
        variant: "destructive",
      })
      router.push("/professionals")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfessional()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = {}
      if (editData.specialty && editData.specialty.length >= 2) payload.specialty = editData.specialty
      if (editData.skills && editData.skills.length) payload.skills = editData.skills
      if (editData.status) payload.status = editData.status
      if (editData.bio !== undefined) payload.bio = editData.bio
      // include substitute fields explicitly (allow null to clear)
      if (Object.prototype.hasOwnProperty.call(editData, 'substituteProfessionalId')) payload.substituteProfessionalId = editData.substituteProfessionalId
      if (Object.prototype.hasOwnProperty.call(editData, 'substituteUntil')) payload.substituteUntil = editData.substituteUntil

      const response = await fetch(`/api/professionals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let details: any = null
        try {
          details = await response.json()
          console.error(`PATCH /api/professionals/${id} failed:`, details)
        } catch (e) {
          try {
            details = await response.text()
            console.error(`PATCH /api/professionals/${id} failed (text):`, details)
          } catch (_) {
            details = null
          }
        }
        const message = details?.error || (details && JSON.stringify(details)) || 'Erro ao atualizar'
        throw new Error(message)
      }

      const updated = await response.json()
      setProfessional((prev: any) => ({ ...prev, ...updated }))
      setEditing(false)

      toast({
        title: "Sucesso",
        description: "Profissional atualizado com sucesso",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o profissional",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const addSkill = () => {
    if (newSkill.trim() && !editData.skills.includes(newSkill.trim())) {
      setEditData((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }))
      setNewSkill("")
    }
  }

  const removeSkill = (skill: string) => {
    setEditData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }))
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/professionals/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao excluir")
      }

      toast({
        title: "Sucesso",
        description: "Profissional removido com sucesso",
        variant: "success",
      })

      router.push("/professionals")
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir o profissional",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!professional) {
    return null
  }

  const canEdit = 
    session?.user?.role === "ADMIN" ||
    professional.userId === session?.user?.id

  const canDelete = session?.user?.role === "ADMIN"

  return (
    <div className="p-6 space-y-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-gray-600 mb-4">
              Tem certeza que deseja remover o profissional <strong>{professional.user.name}</strong>? 
              Esta ação não pode ser desfeita. O usuário será convertido para Solicitante.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/professionals" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para profissionais
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {professional.user.name || "Profissional"}
          </h1>
        </div>

        {canEdit && !editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
            {canDelete && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)} 
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
        )}

        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                {professional.user.image ? (
                  <img
                    src={professional.user.image}
                    alt={professional.user.name || ""}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-indigo-600">
                    {professional.user.name?.charAt(0).toUpperCase() || "P"}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-semibold">{professional.user.name}</h2>

              {editing ? (
                <div className="w-full mt-4 space-y-4 text-left">
                  <div className="space-y-2">
                    <Label>Especialidade</Label>
                    <Input
                      value={editData.specialty}
                      onChange={(e) => setEditData((prev) => ({ ...prev, specialty: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editData.status}
                      onValueChange={(value) => setEditData((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(professionalStatusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(editData.status === 'UNAVAILABLE' || editData.substituteProfessionalId) && (
                    <div className="space-y-2">
                      <Label>Substituto Temporário</Label>
                      <Select value={editData.substituteProfessionalId || "__none"} onValueChange={(v) => setEditData((prev) => ({ ...prev, substituteProfessionalId: v === '__none' ? null : v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um substituto (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Nenhum</SelectItem>
                          {allProfessionals && allProfessionals.filter((p: any) => p.id !== professional.id).map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.user?.name || p.userId}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label>Substituição até (opcional)</Label>
                      <Input type="datetime-local" value={editData.substituteUntil ?? ""} onChange={(e) => setEditData((prev) => ({ ...prev, substituteUntil: e.target.value || null }))} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea
                      value={editData.bio}
                      onChange={(e) => setEditData((prev) => ({ ...prev, bio: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-500">{professional.specialty}</p>
                  <Badge
                    className={`mt-2 ${
                      professionalStatusColors[professional.status as keyof typeof professionalStatusColors]
                    }`}
                  >
                    {professionalStatusLabels[professional.status as keyof typeof professionalStatusLabels]}
                  </Badge>
                </>
              )}

              <div className="w-full mt-6 space-y-3 text-left">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="h-5 w-5" />
                  <span className="text-sm">{professional.user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Briefcase className="h-5 w-5" />
                  <span className="text-sm">{professional.openOrdersCount} pedido(s) em aberto</span>
                </div>
              </div>

              {professional.bio && !editing && (
                <div className="w-full mt-4 pt-4 border-t text-left">
                  <p className="text-sm text-gray-600">{professional.bio}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Skills and Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle>Habilidades</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Nova habilidade..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addSkill()
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={addSkill}>
                      Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editData.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800"
                      >
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)}>
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : professional.skills.length === 0 ? (
                <p className="text-gray-500">Nenhuma habilidade cadastrada</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {professional.skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Atribuídos</CardTitle>
            </CardHeader>
            <CardContent>
              {professional.orders.length === 0 ? (
                <p className="text-gray-500">Nenhum pedido atribuído</p>
              ) : (
                <div className="space-y-3">
                  {professional.orders.map((order: any) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="block p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h4 className="font-medium">{order.title}</h4>
                          <p className="text-sm text-gray-500">
                            Por: {order.requester.name} • {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.status} />
                          <PriorityBadge priority={order.priority} />
                        </div>
                      </div>
                    </Link>
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
