// Define enums locally to avoid Prisma client import issues
export type Role = "ADMIN" | "REQUESTER" | "PROFESSIONAL"
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"
export type OrderStatus = "NEW" | "IN_ANALYSIS" | "IN_PROGRESS" | "WAITING_CLIENT" | "FINISHED" | "CANCELLED"
export type ProfessionalStatus = "AVAILABLE" | "BUSY" | "UNAVAILABLE"

// Base types
export interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: Role
  createdAt: Date
  updatedAt: Date
  managedTags?: Tag[]
}

export interface Professional {
  id: string
  userId: string
  specialty: string
  skills: string[]
  bio: string | null
  status: ProfessionalStatus
  substituteProfessionalId?: string | null
  substituteUntil?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  id: string
  title: string
  description: string
  status: OrderStatus
  priority: Priority
  requesterId: string
  professionalId: string | null
  rating: number | null
  feedback: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: Date
}

export interface Attachment {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  orderId: string
  uploadedById: string
  createdAt: Date
}

export interface Message {
  id: string
  content: string
  orderId: string
  userId: string
  createdAt: Date
}

export interface StatusHistory {
  id: string
  orderId: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  observation: string | null
  changedById: string
  createdAt: Date
}

// Extended types with relations
export type OrderWithRelations = Order & {
  requester: User
  professional: (Professional & { user: User }) | null
  tags: Tag[]
  attachments: Attachment[]
  messages: (Message & { user: User })[]
  statusHistory: (StatusHistory & { changedBy: User })[]
}

export type ProfessionalWithUser = Professional & {
  user: User
  orders: Order[]
}

export type MessageWithUser = Message & {
  user: User
}

export type StatusHistoryWithUser = StatusHistory & {
  changedBy: User
}

export type DashboardStats = {
  totalOrders: number
  openOrders: number
  finishedOrders: number
  cancelledOrders: number
  totalProfessionals: number
  availableProfessionals: number
  ordersByStatus: { status: string; count: number }[]
  ordersByPriority: { priority: string; count: number }[]
  recentOrders: OrderWithRelations[]
}

export type OrderFilters = {
  status?: string[]
  priority?: string[]
  professionalId?: string
  requesterId?: string
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export type ProfessionalFilters = {
  status?: string[]
  skills?: string[]
  hasOpenOrders?: boolean
  search?: string
}
