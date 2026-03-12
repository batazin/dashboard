"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { roleLabels, professionalStatusLabels } from "@/lib/utils"

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(session?.user?.name || "")
  
  // Dados do profissional
  const [professional, setProfessional] = useState<any>(null)
  const [specialty, setSpecialty] = useState("")
  const [bio, setBio] = useState("")
  const [status, setStatus] = useState("AVAILABLE")
  const [substituteProfessionalId, setSubstituteProfessionalId] = useState<string | null>(null)
  const [substituteUntil, setSubstituteUntil] = useState<string | null>(null)
  const [allProfessionals, setAllProfessionals] = useState<any[]>([])

  // Buscar dados do profissional se for PROFESSIONAL
  useEffect(() => {
    const fetchProfessionalData = async () => {
      if (session?.user?.role === "PROFESSIONAL") {
        try {
          const response = await fetch("/api/professionals")
          if (response.ok) {
            const data = await response.json()
            // A API retorna { professionals: [...], pagination: {...} }
            const professionals = data.professionals || data
            // Encontrar o profissional do usuário atual
            const myProfessional = professionals.find((p: any) => p.userId === session.user.id)
            if (myProfessional) {
              setProfessional(myProfessional)
              setSpecialty(myProfessional.specialty || "")
              setBio(myProfessional.bio || "")
              setStatus(myProfessional.status || "AVAILABLE")
              setSubstituteProfessionalId(myProfessional.substituteProfessionalId || null)
              setSubstituteUntil(myProfessional.substituteUntil ? new Date(myProfessional.substituteUntil).toISOString().slice(0,16) : null)
            }
          }
        } catch (error) {
          console.error("Erro ao buscar dados do profissional:", error)
        }
      }
      setLoading(false)
    }

    if (session?.user) {
      setName(session.user.name || "")
      fetchProfessionalData()
      // also fetch list of professionals for substitute selection
      fetch("/api/professionals").then(r => r.ok ? r.json() : null).then(data => {
        const list = data?.professionals || data || []
        setAllProfessionals(Array.isArray(list) ? list : [])
      }).catch(() => {})
    }
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Atualizar dados do profissional se for PROFESSIONAL
      if (session?.user?.role === "PROFESSIONAL" && professional) {
        const payload: any = {}
        if (specialty && specialty.length >= 2) payload.specialty = specialty
        if (bio !== undefined) payload.bio = bio
        if (status) payload.status = status
        // include substitute fields explicitly (allow null to clear)
        if (typeof substituteProfessionalId !== 'undefined') payload.substituteProfessionalId = substituteProfessionalId
        if (typeof substituteUntil !== 'undefined') payload.substituteUntil = substituteUntil

        const response = await fetch(`/api/professionals/${professional.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          let details: any = null
          try {
            details = await response.json()
            console.error('PATCH /api/professionals/:id failed:', details)
          } catch (e) {
            try {
              details = await response.text()
              console.error('PATCH /api/professionals/:id failed (text):', details)
            } catch (_) {
              details = null
            }
          }
          const message = details?.error || (details && JSON.stringify(details)) || 'Erro ao atualizar profissional'
          throw new Error(message)
        }

        const updated = await response.json()
        setProfessional(updated)
      }

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!session?.user) {
    return null
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={session.user.image || undefined} />
              <AvatarFallback className="text-2xl">
                {session.user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{session.user.name || "Usuário"}</h2>
              <p className="text-gray-500 dark:text-gray-400">{session.user.email}</p>
              <Badge className="mt-2">
                {roleLabels[session.user.role as keyof typeof roleLabels] || session.user.role}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={session.user.email || ""}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                O email não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <Input
                value={roleLabels[session.user.role as keyof typeof roleLabels] || session.user.role}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Card de Profissional - só aparece para PROFESSIONAL */}
      {session.user.role === "PROFESSIONAL" && (
        <Card>
          <CardHeader>
            <CardTitle>Informações Profissionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialty">Cargo</Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Analista">Analista</SelectItem>
                  <SelectItem value="Desenvolvedor">Desenvolvedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status de Disponibilidade</Label>
              <Select value={status} onValueChange={setStatus}>
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

            {(status === 'UNAVAILABLE' || substituteProfessionalId) && (
              <div className="space-y-2">
                <Label htmlFor="substitute">Substituto Temporário</Label>
                <Select value={substituteProfessionalId || "__none"} onValueChange={(v) => setSubstituteProfessionalId(v === '__none' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um substituto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhum</SelectItem>
                    {allProfessionals.filter(p => p.id !== professional.id).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.user?.name || p.userId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label htmlFor="substituteUntil">Substituição até (opcional)</Label>
                <Input type="datetime-local" value={substituteUntil ?? ""} onChange={(e) => setSubstituteUntil(e.target.value || null)} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Descrição</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte um pouco sobre você e sua experiência..."
                rows={4}
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Alterar Senha</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Para alterar sua senha, solicite uma redefinição via email.
            </p>
            <Button variant="outline">Solicitar Redefinição</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
