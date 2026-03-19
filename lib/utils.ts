import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function isValidFileType(mimeType: string): boolean {
  return ALLOWED_FILE_TYPES.includes(mimeType)
}

export function isValidFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE
}

export const priorityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800'
}

export const statusColors = {
  NEW: 'bg-purple-100 text-purple-800',
  IN_ANALYSIS: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING_CLIENT: 'bg-orange-100 text-orange-800',
  WAITING_CONFIRMATION: 'bg-cyan-100 text-cyan-800',
  FINISHED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
}

export const statusLabels = {
  NEW: 'Novo',
  IN_ANALYSIS: 'Em Análise',
  IN_PROGRESS: 'Em Execução',
  WAITING_CLIENT: 'Aguardando Cliente',
  WAITING_CONFIRMATION: 'Aguardando Confirmação',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado'
}

export const priorityLabels = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
}

export const roleLabels = {
  ADMIN: 'Administrador',
  REQUESTER: 'Analista',
  PROFESSIONAL: 'Dev'
}

export const professionalStatusLabels = {
  AVAILABLE: 'Disponível',
  UNAVAILABLE: 'Indisponível',
  BUSY: 'Ocupado'
}

export const professionalStatusColors = {
  AVAILABLE: 'bg-green-100 text-green-800',
  UNAVAILABLE: 'bg-gray-100 text-gray-800',
  BUSY: 'bg-yellow-100 text-yellow-800'
}

export const PREDEFINED_TAGS = [
  { name: "DERMA", color: "#FFDFEF", textColor: "#C2185B" },
  { name: "USA", color: "#0D47A1", textColor: "#FFFFFF" },
  { name: "MENTORIA", color: "#6096BA", textColor: "#FFFFFF" },
  { name: "EXTENSIVO", color: "#740909", textColor: "#FFFFFF" },
  { name: "REVALIDA", color: "#5E35B1", textColor: "#FFFFFF" },
  { name: "ANESTESIO", color: "#424242", textColor: "#FFFFFF" },
  { name: "ENDOCRINO", color: "#B71C1C", textColor: "#FFFFFF" },
  { name: "OFTALMO", color: "#1A237E", textColor: "#FFFFFF" },
  { name: "PEDIATRIA", color: "#FFECB3", textColor: "#795548" },
  { name: "CLINICOF", color: "#D32F2F", textColor: "#FFFFFF" },
  { name: "G.O", color: "#F48FB1", textColor: "#AD1457" },
  { name: "CARDIO", color: "#B71C1C", textColor: "#FFFFFF" },
  { name: "CIRURGIA", color: "#B3E5FC", textColor: "#0288D1" },
  { name: "HANDS", color: "#1565C0", textColor: "#FFFFFF" },
  { name: "HIIT TARGET", color: "#4DB6AC", textColor: "#000000" },
  { name: "AULAS", color: "#000B1D", textColor: "#FFFFFF" },
  { name: "HIIT", color: "#E040FB", textColor: "#FFFFFF" },
  { name: "RADIO", color: "#7986CB", textColor: "#FFFFFF" },
  { name: "TEMI", color: "#2196F3", textColor: "#FFFFFF" },
  { name: "HOME", color: "#EEEEEE", textColor: "#D32F2F" },
  { name: "EVENTOS", color: "#EEEEEE", textColor: "#0D47A1" },
  { name: "UROLOGIA", color: "#1A237E", textColor: "#FFFFFF" },
  { name: "Concursus", color: "#0D47A1", textColor: "#FFFFFF" },
  { name: "BLACK NOVEMBER", color: "#000000", textColor: "#FFFFFF" },
  { name: "PS lifehack", color: "#FF9800", textColor: "#FFFFFF" },
  { name: "Ortopedia", color: "#009688", textColor: "#FFFFFF" },
  { name: "Semiextensivo", color: "#880E4F", textColor: "#FFFFFF" },
  { name: "Internato", color: "#006064", textColor: "#FFFFFF" },
]

export function getTagStyles(tagName: string, fallbackColor?: string) {
  const predefined = PREDEFINED_TAGS.find(t => t.name.toUpperCase() === tagName.toUpperCase())
  if (predefined) {
    return {
      backgroundColor: predefined.color,
      color: predefined.textColor
    }
  }
  const color = fallbackColor || "#6366f1"
  return {
    backgroundColor: color + "15",
    color: color
  }
}
