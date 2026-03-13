"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { SocketProvider } from "@/lib/socket"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="theme">
      <SessionProvider>
        <SocketProvider>
          {children}
          <Toaster />
        </SocketProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
