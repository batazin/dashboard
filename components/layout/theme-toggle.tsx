"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Manual fallback to ensure theme class is applied correctly
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (resolvedTheme === 'light') {
      document.documentElement.classList.remove('dark')
    }
  }, [resolvedTheme])

  if (!mounted) {
    return <div className="w-10 h-10" />
  }

  const isDark = resolvedTheme === "dark"

  const handleThemeToggle = () => {
    console.log("Toggling theme from:", resolvedTheme)
    const newTheme = isDark ? "light" : "dark"
    setTheme(newTheme)
    console.log("Switched to:", newTheme)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleThemeToggle}
      className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 shadow-lg border border-border transition-all duration-300 bg-white dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-800"
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
    >
      {isDark ? (
        <Sun className="h-6 w-6 text-yellow-500" />
      ) : (
        <Moon className="h-6 w-6 text-blue-600" />
      )}
    </Button>
  )
}
