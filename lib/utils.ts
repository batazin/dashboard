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
  FINISHED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
}

export const statusLabels = {
  NEW: 'Novo',
  IN_ANALYSIS: 'Em Análise',
  IN_PROGRESS: 'Em Execução',
  WAITING_CLIENT: 'Aguardando Cliente',
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
  REQUESTER: 'Solicitante',
  PROFESSIONAL: 'Profissional'
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
