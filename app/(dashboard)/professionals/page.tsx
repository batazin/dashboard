"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Search, Plus, X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { useToast } from "@/hooks/use-toast"
import { professionalStatusLabels, professionalStatusColors } from "@/lib/utils"

interface Professional {
  id: string
  specialty: string
  skills: string[]
  status: string
  bio: string | null
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  openOrdersCount: number
}

export default function ProfessionalsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)

  const [newProfessional, setNewProfessional] = useState({
    name: "",
    email: "",
    specialty: "",
    skills: [] as string[],
    bio: "",
  })
  const [newSkill, setNewSkill] = useState("")

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  const fetchProfessionals = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    
    if (search) params.set("search", search)
    if (status && status !== "all") params.set("status", status)
    params.set("page", pagination.page.toString())
    params.set("limit", pagination.limit.toString())

    try {
      const response = await fetch(`/api/professionals?${params}`)
      const data = await response.json()
      setProfessionals(data.professionals || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      console.error("Error fetching professionals:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfessionals()
  }, [status, pagination.page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    fetchProfessionals()
  }

  const addSkill = () => {
    if (newSkill.trim() && !newProfessional.skills.includes(newSkill.trim())) {
      setNewProfessional((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }))
      setNewSkill("")
    }
  }

  const removeSkill = (skill: string) => {
    setNewProfessional((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }))
  }

  const handleCreate = async () => {
    if (!newProfessional.name || !newProfessional.email || !newProfessional.specialty) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      })
      return
    }

    if (newProfessional.skills.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma habilidade",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      const response = await fetch("/api/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfessional),
      })

      if (!response.ok) {
        let details: any = null
        try {
          details = await response.json()
          console.error('POST /api/professionals failed:', details)
        } catch (e) {
          try { details = await response.text() } catch(_) { details = null }
        }
        throw new Error(details?.error || (details && JSON.stringify(details)) || "Erro ao criar profissional")
      }

      toast({
        title: "Sucesso",
        description: "Profissional criado com sucesso",
        variant: "success",
      })

      setShowCreateDialog(false)
      setNewProfessional({ name: "", email: "", specialty: "", skills: [], bio: "" })
      fetchProfessionals()
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar profissional",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devs</h1>
          <p className="text-gray-500">
            {pagination.total} dev{pagination.total !== 1 ? "s" : ""} encontrado{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
        
        {session?.user?.role === "ADMIN" && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Dev
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Dev</DialogTitle>
                <DialogDescription>
                  Cadastre um novo dev no sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={newProfessional.name}
                    onChange={(e) => setNewProfessional((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newProfessional.email}
                    onChange={(e) => setNewProfessional((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Especialidade *</Label>
                  <Input
                    value={newProfessional.specialty}
                    onChange={(e) => setNewProfessional((prev) => ({ ...prev, specialty: e.target.value }))}
                    placeholder="Ex: Desenvolvedor Full Stack"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Habilidades *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Ex: React, Node.js"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addSkill()
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={addSkill}>
                      +
                    </Button>
                  </div>
                  {newProfessional.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newProfessional.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800"
                        >
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Input
                    value={newProfessional.bio}
                    onChange={(e) => setNewProfessional((prev) => ({ ...prev, bio: e.target.value }))}
                    placeholder="Breve descrição..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
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
                  placeholder="Buscar devs..."
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
                  {Object.entries(professionalStatusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(search || status !== "all") && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professionals Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Carregando...</p>
        </div>
      ) : professionals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum dev encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((professional) => (
            <Link key={professional.id} href={`/professionals/${professional.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      {professional.user.image ? (
                        <img
                          src={professional.user.image}
                          alt={professional.user.name || ""}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-indigo-600">
                          {professional.user.name?.charAt(0).toUpperCase() || "P"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {professional.user.name || "Dev"}
                      </h3>
                      <p className="text-sm text-gray-500">{professional.specialty}</p>
                      <Badge
                        className={`mt-2 ${
                          professionalStatusColors[professional.status as keyof typeof professionalStatusColors]
                        }`}
                      >
                        {professionalStatusLabels[professional.status as keyof typeof professionalStatusLabels]}
                      </Badge>
                    </div>
                  </div>

                  {professional.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4">
                      {professional.skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700"
                        >
                          {skill}
                        </span>
                      ))}
                      {professional.skills.length > 4 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                          +{professional.skills.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t flex justify-between text-sm text-gray-500">
                    <span>{professional.openOrdersCount} pedido(s) em aberto</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
          <span className="text-sm text-gray-500">
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
