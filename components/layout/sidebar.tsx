"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  BarChart3,
  Play,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { NotificationBell } from "./notification-bell"
import { ThemeToggle } from "./theme-toggle"
import { useSocket } from "@/lib/socket"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Pedidos", href: "/orders", icon: ClipboardList },
  { name: "Profissionais", href: "/professionals", icon: Users },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Perfil", href: "/profile", icon: User },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { isConnected } = useSocket()
  const { toast } = useToast()

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg">Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="pt-16 px-4 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
              <Link
                href="/orders/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                Novo Pedido
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col grow bg-background border-r border-border">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg">Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all duration-500",
                  isConnected 
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" 
                    : (process.env.NODE_ENV === 'production' 
                        ? "bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" // In production we show green (polling active)
                        : "bg-red-400")
                )} 
                title={isConnected ? 'Socket conectado' : (process.env.NODE_ENV === 'production' ? 'Sistema Online (Modo Otimizado)' : 'Socket desconectado')} 
              />
              {!isConnected && process.env.NODE_ENV === 'development' && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Start Socket Server"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/socket/start', { method: 'POST' })
                      const data = await res.json().catch(() => ({}))
                      if (res.ok) {
                        toast({ title: 'Socket server iniciado (ou já rodando)', description: 'Verifique logs do terminal e atualize a página', variant: 'success' })
                      } else {
                        toast({ title: 'Falha ao iniciar socket server', description: data?.error || 'Erro desconhecido', variant: 'destructive' })
                      }
                    } catch (err) {
                      toast({ title: 'Falha ao iniciar socket server', description: String(err), variant: 'destructive' })
                    }
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <NotificationBell />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* New Order Button */}
          <div className="px-4 pb-4">
            <Link href="/orders/new">
              <Button className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Novo Pedido
              </Button>
            </Link>
          </div>

          {/* User section */}
          <div className="border-t border-border p-4 space-y-2">
            <div className="flex items-center justify-between px-3">

            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session?.user?.image || undefined} />
                    <AvatarFallback>
                      {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">{session?.user?.name || "Usuário"}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{session?.user?.email}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  )
}
