import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { orderCreateSchema } from "@/lib/validations"
import { ZodError } from "zod"
import { notifyProfessionalAssigned } from "@/lib/notifications"

// GET /api/orders - List orders with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")?.split(",")
    const priority = searchParams.get("priority")?.split(",")
    const professionalId = searchParams.get("professionalId")
    const requesterId = searchParams.get("requesterId")
    const tags = searchParams.get("tags")?.split(",")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")

    const where: any = {}

    console.log("=== DEBUG Orders GET ===")
    console.log("User ID:", session.user.id)
    console.log("User Role:", session.user.role)
    console.log("User Email:", session.user.email)

    // Role-based filtering
    if (session.user.role === "REQUESTER") {
      // REQUESTER vê apenas pedidos que criou
      where.requesterId = session.user.id
      console.log("Filtering by requesterId:", session.user.id)
    } else if (session.user.role === "PROFESSIONAL") {
      // PROFESSIONAL vê pedidos que criou OU que está atribuído
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id }
      })
      
      const orConditions: any[] = [
        { requesterId: session.user.id } // Pedidos que criou
      ]
      
      if (professional) {
        orConditions.push({ professionalId: professional.id }) // Pedidos atribuídos a ele
      }
      
      where.OR = orConditions
      console.log("Filtering by PROFESSIONAL - requesterId OR professionalId")
    }
    // ADMIN não tem filtro - vê todos os pedidos

    // Apply filters
    if (status?.length) {
      where.status = { in: status }
    }
    if (priority?.length) {
      where.priority = { in: priority }
    }
    if (professionalId) {
      where.professionalId = professionalId
    }
    if (requesterId && session.user.role === "ADMIN") {
      where.requesterId = requesterId
    }
    if (tags?.length) {
      where.tags = { some: { name: { in: tags } } }
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          requester: true,
          professional: { include: { user: true } },
          tags: true,
          attachments: true,
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    console.log("Where clause:", JSON.stringify(where, null, 2))
    console.log("Orders found:", orders.length)
    console.log("Total count:", total)
    if (orders.length > 0) {
      console.log("First order requesterId:", orders[0].requesterId)
    }

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json(
      { error: "Erro ao buscar pedidos" },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    console.log("📥 POST /api/orders body:", JSON.stringify(body))
    const validatedData = orderCreateSchema.parse(body)
    console.log("✅ orderCreateSchema validated:", JSON.stringify(validatedData))

    // Resolve requester user: prefer id, fallback to email (to handle sessions without id)
    let requester = null
    if (session.user.id) {
      requester = await prisma.user.findUnique({ where: { id: session.user.id } })
    }
    if (!requester && session.user.email) {
      requester = await prisma.user.findUnique({ where: { email: session.user.email } })
      if (requester) {
        console.log(`Resolved requester by email ${session.user.email} -> user.id=${requester.id}`)
      }
    }
    if (!requester) {
      console.error(`Requester user not found in DB for session user: id=${session.user.id} email=${session.user.email}`)
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 400 })
    }

    // Determine assigned professional, respecting temporary substitutes
    let assignedProfessionalId: string | null | undefined = validatedData.professionalId
    let notifyUserId: string | null = null
    if (validatedData.professionalId) {
      const targetProf = await prisma.professional.findUnique({ where: { id: validatedData.professionalId } })

      // if the target professional doesn't exist, do not assign
      if (!targetProf) {
        assignedProfessionalId = null
        notifyUserId = null
      } else {
        const now = new Date()
        const substituteId = targetProf.substituteProfessionalId as string | null | undefined
        const substituteUntilRaw = targetProf.substituteUntil as Date | string | null | undefined
        const substituteUntilDate = substituteUntilRaw ? new Date(substituteUntilRaw) : null
        const substituteActive = Boolean(substituteId && (!substituteUntilDate || substituteUntilDate > now))

        if (targetProf.status === 'UNAVAILABLE' && substituteActive) {
          // only assign substitute if substitute record actually exists
          const substituteProf = await prisma.professional.findUnique({ where: { id: substituteId as string } })
          if (substituteProf) {
            assignedProfessionalId = substituteProf.id
            notifyUserId = substituteProf.userId
          } else {
            console.warn(`Substitute ${substituteId} configured for professional ${targetProf.id} not found; falling back to original professional.`)
            assignedProfessionalId = targetProf.id
            notifyUserId = targetProf.userId
          }
        } else {
          // use the original professional
          assignedProfessionalId = targetProf.id
          notifyUserId = targetProf.userId
        }
      }
    }

    const createData: any = {
      title: validatedData.title,
      description: validatedData.description,
      priority: validatedData.priority,
      requesterId: requester.id,
      // only include professionalId when defined and not null
      ...(assignedProfessionalId ? { professionalId: assignedProfessionalId } : {}),
        tags: validatedData.tags?.length
          ? {
              connectOrCreate: validatedData.tags.map((tag) => ({
                where: { name: tag },
                create: { name: tag },
              })),
            }
          : undefined,
        statusHistory: {
            create: {
            toStatus: "NEW",
            changedById: requester.id,
            observation: "Pedido criado",
          },
        },
    }

    console.log("🧾 Creating order with data:", JSON.stringify(createData))

    let order
    try {
      order = await prisma.order.create({
        data: createData,
        include: {
        requester: true,
        professional: { include: { user: true } },
        tags: true,
        attachments: true,
        statusHistory: { include: { changedBy: true } },
        },
      })
    } catch (createError) {
      console.error("Prisma create error for order:", createError)
      console.error("Prisma create params:", JSON.stringify({ data: createData }))
      throw createError
    }

    // Notificar profissional que recebeu a atribuição (pode ser substituto)
    if (notifyUserId) {
      try {
        // verify the user exists to avoid FK violation when creating Notification
        const userExists = await prisma.user.findUnique({ where: { id: notifyUserId } })
        if (!userExists) {
          console.warn(`⚠️ notifyUserId ${notifyUserId} does not exist in users table; skipping notification for order ${order.id}`)
        } else {
          console.log(`🔔 Creating notification for professional ${notifyUserId} about order ${order.id}`)
          const notification = await notifyProfessionalAssigned(
            notifyUserId,
            order.id,
            order.title,
            session.user.name || "Usuário"
          )
          if (notification) {
            console.log(`✅ Notification created successfully: ${notification.id}`)
          } else {
            console.log(`❌ Failed to create notification`)
          }
        }
      } catch (notifyErr) {
        console.error('Error while attempting to notify professional:', notifyErr)
      }
    } else {
      console.log(`ℹ️ No professional assigned to order ${order.id}, skipping notification`)
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Error creating order:", error)
    
    // Erro de validação Zod - retorna mensagens amigáveis
    if (error instanceof ZodError) {
      const messages = error.issues.map((e: { message: string }) => e.message).join(", ")
      return NextResponse.json({ error: messages }, { status: 400 })
    }
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Erro ao criar pedido" },
      { status: 500 }
    )
  }
}
