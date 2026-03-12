import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { professionalCreateSchema } from "@/lib/validations"
import { ZodError } from 'zod'
import bcrypt from "bcryptjs"
import type { Order, Professional, User } from "@/types"

type ProfessionalWithOrders = Professional & {
  user: User
  orders: Order[]
}

// GET /api/professionals - List professionals with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")?.split(",")
    const skills = searchParams.get("skills")?.split(",")
    const hasOpenOrders = searchParams.get("hasOpenOrders")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")

    const where: any = {}

    if (status?.length) {
      where.status = { in: status }
    }

    if (skills?.length) {
      where.skills = { hasSome: skills }
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { specialty: { contains: search, mode: "insensitive" } },
      ]
    }

    const [professionals, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        include: {
          user: true,
          orders: {
            where: {
              status: { notIn: ["FINISHED", "CANCELLED"] },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.professional.count({ where }),
    ])

    // Filter by open orders if requested
    let filteredProfessionals: ProfessionalWithOrders[] = professionals
    if (hasOpenOrders === "true") {
      filteredProfessionals = professionals.filter((p: ProfessionalWithOrders) => p.orders.length > 0)
    } else if (hasOpenOrders === "false") {
      filteredProfessionals = professionals.filter((p: ProfessionalWithOrders) => p.orders.length === 0)
    }

    return NextResponse.json({
      professionals: filteredProfessionals.map((p: ProfessionalWithOrders) => ({
        ...p,
        openOrdersCount: p.orders.length,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching professionals:", error)
    return NextResponse.json(
      { error: "Erro ao buscar profissionais" },
      { status: 500 }
    )
  }
}

// POST /api/professionals - Create new professional (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    console.log('POST /api/professionals - request body:', body)
    let validatedData: any
    try {
      validatedData = professionalCreateSchema.parse(body)
    } catch (err) {
      if (err instanceof ZodError) {
        console.error('Validation error creating professional:', err.issues)
        return NextResponse.json({ error: 'Validação inválida', details: err.issues }, { status: 400 })
      }
      throw err
    }
    console.log('POST /api/professionals - validated data:', validatedData)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      // Check if already a professional
      const existingProfessional = await prisma.professional.findUnique({
        where: { userId: existingUser.id },
      })

      if (existingProfessional) {
        return NextResponse.json(
          { error: "Este usuário já é um profissional" },
          { status: 400 }
        )
      }

      // Create professional profile for existing user
      const professional = await prisma.professional.create({
        data: {
          userId: existingUser.id,
          specialty: validatedData.specialty,
          skills: validatedData.skills,
          bio: validatedData.bio,
        },
        include: { user: true },
      })

      // Update user role
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: "PROFESSIONAL" },
      })

      return NextResponse.json(professional, { status: 201 })
    }

    // Create new user and professional
    const hashedPassword = await bcrypt.hash("senha123", 10) // Default password

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: "PROFESSIONAL",
        professional: {
          create: {
            specialty: validatedData.specialty,
            skills: validatedData.skills,
            bio: validatedData.bio,
          },
        },
      },
      include: {
        professional: true,
      },
    })

    return NextResponse.json(user.professional, { status: 201 })
  } catch (error) {
    console.error("Error creating professional:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Erro ao criar profissional" },
      { status: 500 }
    )
  }
}
