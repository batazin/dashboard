import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { userUpdateSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        managedTags: true,
        professional: true,
      } as any,
    })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Erro ao buscar perfil" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = userUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name) updateData.name = validatedData.name
    if (validatedData.image) updateData.image = validatedData.image
    
    if (validatedData.managedTags) {
      // Ensure all tags exist in the DB (upsert style)
      // This handles cases where the DB hasn't been seeded yet
      const { PREDEFINED_TAGS } = require("@/lib/utils")
      
      const tagPromises = validatedData.managedTags.map(async (tagName: string) => {
        const predefined = PREDEFINED_TAGS.find((t: any) => t.name.toUpperCase() === tagName.toUpperCase())
        return prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: {
            name: tagName,
            color: predefined?.color || "#6366f1",
          },
        })
      })
      
      await Promise.all(tagPromises)

      updateData.managedTags = {
        set: validatedData.managedTags.map((tagName: string) => ({ name: tagName })),
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      include: {
        managedTags: true,
      } as any,
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error updating profile:", error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validação inválida", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 })
  }
}
