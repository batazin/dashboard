"use client"

import { Badge } from "@/components/ui/badge"
import { cn, statusColors, statusLabels, priorityColors, priorityLabels } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800",
        "border-0",
        className
      )}
    >
      {statusLabels[status as keyof typeof statusLabels] || status}
    </Badge>
  )
}

interface PriorityBadgeProps {
  priority: string
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      className={cn(
        priorityColors[priority as keyof typeof priorityColors] || "bg-gray-100 text-gray-800",
        "border-0",
        className
      )}
    >
      {priorityLabels[priority as keyof typeof priorityLabels] || priority}
    </Badge>
  )
}
