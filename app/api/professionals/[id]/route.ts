import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { professionalUpdateSchema } from "@/lib/validations"
import { ZodError } from 'zod'
import type { Order } from "@/types"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/professionals/[id] - Get single professional
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const professional = await prisma.professional.findUnique({
      where: { id },
      include: {
        user: true,
        orders: {
          include: {
            requester: true,
            tags: true,
            attachments: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!professional) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      ...professional,
      openOrdersCount: professional.orders.filter(
        (o: Order) => !["FINISHED", "CANCELLED"].includes(o.status)
      ).length,
    })
  } catch (error) {
    console.error("Error fetching professional:", error)
    return NextResponse.json({ error: "Erro ao buscar profissional" }, { status: 500 })
  }
}

// PATCH /api/professionals/[id] - Update professional
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    console.log(`PATCH /api/professionals/${id} - request body:`, body)

    let validatedData: any
    try {
      validatedData = professionalUpdateSchema.parse(body)
    } catch (err) {
      if (err instanceof ZodError) {
        console.error(`Validation error updating professional ${id}:`, err.issues)
        return NextResponse.json({ error: 'Validação inválida', details: err.issues }, { status: 400 })
      }
      throw err
    }

    console.log(`PATCH /api/professionals/${id} - validated data:`, validatedData)

    const existingProfessional = await prisma.professional.findUnique({
      where: { id },
    })

    if (!existingProfessional) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 })
    }

    // Only admin or the professional themselves can update
    if (
      session.user.role !== "ADMIN" &&
      existingProfessional.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const updateData: any = {}
    if (validatedData.specialty) updateData.specialty = validatedData.specialty
    if (validatedData.skills) updateData.skills = validatedData.skills
    if (validatedData.status) updateData.status = validatedData.status
    if (Object.prototype.hasOwnProperty.call(validatedData, 'substituteProfessionalId')) updateData.substituteProfessionalId = validatedData.substituteProfessionalId
    if (validatedData.substituteUntil !== undefined) updateData.substituteUntil = validatedData.substituteUntil ? new Date(validatedData.substituteUntil) : null
    if (validatedData.bio !== undefined) updateData.bio = validatedData.bio

    console.log(`PATCH /api/professionals/${id} - updateData:`, updateData)

    if (Object.keys(updateData).length === 0) {
      console.warn(`No fields to update for professional ${id}`)
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    try {
      const professional = await prisma.professional.update({
        where: { id },
        data: updateData,
        include: { user: true },
      })
      console.log(`Professional ${id} updated successfully:`, { id: professional.id })
      return NextResponse.json(professional)
    } catch (prismaErr) {
      console.error(`Prisma update error for professional ${id}:`, prismaErr)
      if (prismaErr instanceof Error) {
        return NextResponse.json({ error: prismaErr.message, stack: prismaErr.stack }, { status: 400 })
      }
      return NextResponse.json({ error: 'Erro no banco ao atualizar profissional' }, { status: 500 })
    }
  } catch (error) {
    console.error("Error updating professional:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro ao atualizar profissional" }, { status: 500 })
  }
}

// DELETE /api/professionals/[id] - Delete professional (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const existingProfessional = await prisma.professional.findUnique({
      where: { id },
    })

    if (!existingProfessional) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 })
    }

    // Delete professional and update user role
    await prisma.$transaction([
      prisma.professional.delete({ where: { id } }),
      prisma.user.update({
        where: { id: existingProfessional.userId },
        data: { role: "REQUESTER" },
      }),
    ])

    return NextResponse.json({ message: "Profissional excluído com sucesso" })
  } catch (error) {
    console.error("Error deleting professional:", error)
    return NextResponse.json({ error: "Erro ao excluir profissional" }, { status: 500 })
  }
}
