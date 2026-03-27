"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { priorityLabels, cn, PREDEFINED_TAGS, getTagStyles, getNeonStyles } from "@/lib/utils"
import { ArrowLeft, X } from "lucide-react"
import Link from "next/link"

interface Professional {
  id: string
  user: {
    name: string | null;
    email?: string | null;
    managedTags?: { name: string }[]
  }
  specialty: string
}

interface Tag {
  id: string
  name: string
  color: string
}

export default function NewOrderPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [existingTags, setExistingTags] = useState<Tag[]>([])
  const [userManagedTags, setUserManagedTags] = useState<string[]>([])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    professionalId: "none",
    tags: [] as string[],
    pageUrl: "",
  })
  const [newTag, setNewTag] = useState("")
  const [tagQuery, setTagQuery] = useState("")
  const [substituteNotice, setSubstituteNotice] = useState<string | null>(null)

  useEffect(() => {
    // Fetch professionals
    fetch("/api/professionals")
      .then((res) => res.json())
      .then((data) => setProfessionals(data.professionals || []))
      .catch(console.error)

    // Fetch existing tags
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => setExistingTags(data))
      .catch(console.error)

    // Fetch user managed tags to filter available tags
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.managedTags) {
          setUserManagedTags(data.managedTags.map((t: any) => t.name))
        }
      })
      .catch(console.error)
  }, [])

  const handleProfessionalChange = async (value: string) => {
    setSubstituteNotice(null)
    // immediate 'none' selection
    if (value === "none") {
      setFormData((prev) => ({ ...prev, professionalId: "none" }))
      return
    }

    try {
      // fetch professional details (includes status a
      const res = await fetch(`/api/professionals/${value}`)
      if (!res.ok) throw new Error('Erro ao buscar profissional')
      const prof = await res.json()

      const now = new Date()
      const substituteId: string | null = prof.substituteProfessionalId ?? null
      const substituteUntilRaw = prof.substituteUntil ?? null
      const substituteUntil = substituteUntilRaw ? new Date(substituteUntilRaw) : null
      const substituteActive = Boolean(substituteId && (!substituteUntil || substituteUntil > now))

      if (prof.status === 'UNAVAILABLE' && substituteActive && substituteId) {
        // try find substitute in already-loaded list
        let substitute = professionals.find((p) => p.id === substituteId)
        if (!substitute) {
          const r2 = await fetch(`/api/professionals/${substituteId}`)
          if (r2.ok) substitute = await r2.json()
        }

        if (substitute) {
          setFormData((prev) => ({ ...prev, professionalId: substitute.id }))
          const untilText = substituteUntil ? ` até ${new Date(substituteUntil).toLocaleString()}` : ''
          const notice = `O profissional ${prof.user?.name || prof.user?.email || prof.id} está indisponível${untilText}. Atribuindo ${substitute.user?.name || substitute.user?.email || substitute.id} automaticamente.`
          setSubstituteNotice(notice)
          // also show toast
          toast({ title: 'Profissional indisponível', description: notice, variant: 'default' })
          return
        }

        // substitute configured but not found
        setFormData((prev) => ({ ...prev, professionalId: 'none' }))
        const notice = `O profissional ${prof.user?.name || prof.user?.email || prof.id} está indisponível e o substituto não foi encontrado.`
        setSubstituteNotice(notice)
        toast({ title: 'Substituto não encontrado', description: notice, variant: 'destructive' })
        return
      }

      // normal available or no substitute -> keep selection
      setFormData((prev) => ({ ...prev, professionalId: value }))
      setSubstituteNotice(null)
    } catch (err) {
      console.error('Erro ao processar seleção de profissional', err)
      toast({ title: 'Erro', description: 'Não foi possível verificar o dev selecionado', variant: 'destructive' })
    }
  }

  // Calculate recommended professionals based on selected tags
  const recommendedProfessionals = professionals.filter(prof =>
    prof.user.managedTags?.some(tag => formData.tags.includes(tag.name))
  )

  const isRecommended = (profId: string) => {
    return recommendedProfessionals.some(p => p.id === profId)
  }

  // Auto-select first recommended professional when recommendations change
  useEffect(() => {
    if (recommendedProfessionals.length > 0 && formData.professionalId === "none") {
      setFormData(prev => ({ ...prev, professionalId: recommendedProfessionals[0].id }))
    }
  }, [recommendedProfessionals, formData.professionalId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.professionalId === "none") {
      toast({
        title: "Dev obrigatório",
        description: "Por favor, selecione um desenvolvedor responsável.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          professionalId: formData.professionalId === "none" ? undefined : formData.professionalId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        // Extrai mensagem amigável de erros de validação
        let errorMessage = "Erro ao criar pedido"
        if (Array.isArray(data)) {
          errorMessage = data.map((err: { message?: string }) => err.message).join(", ")
        } else if (data.error) {
          errorMessage = data.error
        } else if (data.message) {
          errorMessage = data.message
        }
        throw new Error(errorMessage)
      }

      const order = await response.json()

      toast({
        title: "Pedido criado!",
        description: "Seu pedido foi criado com sucesso.",
        variant: "success",
      })

      router.push(`/orders/${order.id}`)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar pedido",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }))
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }

  const selectExistingTag = (tagName: string) => {
    if (!formData.tags.includes(tagName)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagName],
      }))
    }
  }

  const filteredPredefinedTags = userManagedTags.length > 0
    ? PREDEFINED_TAGS.filter(tag => userManagedTags.includes(tag.name))
    : PREDEFINED_TAGS

  const filteredExistingTags = userManagedTags.length > 0
    ? existingTags.filter(tag => userManagedTags.includes(tag.name))
    : existingTags

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/orders" className="inline-flex items-center text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para pedidos
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Digite o título do pedido"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva detalhadamente o pedido..."
                rows={5}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pageUrl">Link da Página</Label>
              <Input
                id="pageUrl"
                value={formData.pageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, pageUrl: e.target.value }))}
                placeholder="Ex: https://dominio.com/pagina-do-produto"
              />
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Nova tag..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTag}>
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Predefined Tags Section */}
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                  {userManagedTags.length > 0 ? "Seus produtos gerenciados:" : "Sugestões rápidas:"}
                </span>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 border rounded-md bg-gray-50/50 dark:bg-slate-900/50">
                  {filteredPredefinedTags.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => selectExistingTag(tag.name)}
                      disabled={formData.tags.includes(tag.name)}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100",
                        formData.tags.includes(tag.name) ? "ring-2 ring-primary ring-offset-2" : "shadow-sm"
                      )}
                      style={getTagStyles(tag.name)}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {filteredExistingTags.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Sugestões:</span>
                    <input
                      aria-label="Procurar tags"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      placeholder="Procurar tags..."
                      className="text-sm px-2 py-1 border rounded-md focus:outline-none"
                    />
                    <span className="text-sm text-gray-400">{filteredExistingTags.length} disponíveis</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 max-h-44 overflow-auto">
                    {filteredExistingTags
                      .filter((tag) => !formData.tags.includes(tag.name))
                      .filter((tag) => tag.name.toLowerCase().includes(tagQuery.toLowerCase()))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => selectExistingTag(tag.name)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full font-medium transition-opacity hover:opacity-90"
                          style={getNeonStyles(tag.color)}
                        >
                          + {tag.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-md shadow-sm"
                      style={getTagStyles(tag)}
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label className="font-semibold text-gray-900 dark:text-white">Dev Responsável</Label>
              <Select
                value={formData.professionalId}
                onValueChange={(value) => { void handleProfessionalChange(value) }}
              >
                <SelectTrigger className={cn(
                  recommendedProfessionals.length > 0 && formData.professionalId === "none" && "border-indigo-300 ring-indigo-100",
                  formData.professionalId === "none" && "border-red-200"
                )}>
                  <SelectValue placeholder="Selecione um dev" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione um profissional...</SelectItem>
                  {/* Recommended Professionals first */}
                  {recommendedProfessionals.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50">Recomendados para estas tags</div>
                      {recommendedProfessionals.map((prof) => (
                        <SelectItem key={`rec-${prof.id}`} value={prof.id}>
                          {prof.user.name} - {prof.specialty} ★
                        </SelectItem>
                      ))}
                      <div className="h-px bg-gray-100 my-1" />
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500">Outros desenvolvedores</div>
                    </>
                  )}
                  {professionals
                    .filter(p => !isRecommended(p.id))
                    .map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.user.name} - {prof.specialty}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {substituteNotice && (
                <p className="text-sm text-gray-700 mt-2">{substituteNotice}</p>
              )}
              {recommendedProfessionals.length > 0 && formData.professionalId === "none" && (
                <p className="text-xs text-indigo-600 font-medium animate-pulse">
                  Temos devs recomendados para as tags selecionadas acima!
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Criando..." : "Criar Pedido"}
              </Button>
              <Link href="/orders">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
