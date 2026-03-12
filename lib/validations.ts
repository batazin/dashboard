import { z } from 'zod'

export const orderCreateSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  tags: z.array(z.string()).optional(),
  professionalId: z.string().optional(),
})

export const orderUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['NEW', 'IN_ANALYSIS', 'IN_PROGRESS', 'WAITING_CLIENT', 'FINISHED', 'CANCELLED']).optional(),
  tags: z.array(z.string()).optional(),
  professionalId: z.string().nullable().optional(),
  statusObservation: z.string().optional(),
})

export const orderFinishSchema = z.object({
  feedback: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
})

export const professionalCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  specialty: z.string().min(2, 'Especialidade deve ter pelo menos 2 caracteres'),
  skills: z.array(z.string()).min(1, 'Adicione pelo menos uma habilidade'),
  bio: z.string().optional(),
})

export const professionalUpdateSchema = z.object({
  specialty: z.string().min(2).optional(),
  skills: z.array(z.string()).optional(),
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'BUSY']).optional(),
  substituteProfessionalId: z.string().nullable().optional(),
  substituteUntil: z.string().nullable().optional(), // ISO date string (optional) or null
  bio: z.string().optional(),
})

export const messageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia').max(2000),
  orderId: z.string(),
})

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  image: z.string().url().optional(),
})

export const tagSchema = z.object({
  name: z.string().min(2).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['REQUESTER', 'PROFESSIONAL']).default('REQUESTER'),
})

export type OrderCreateInput = z.infer<typeof orderCreateSchema>
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>
export type OrderFinishInput = z.infer<typeof orderFinishSchema>
export type ProfessionalCreateInput = z.infer<typeof professionalCreateSchema>
export type ProfessionalUpdateInput = z.infer<typeof professionalUpdateSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type TagInput = z.infer<typeof tagSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
