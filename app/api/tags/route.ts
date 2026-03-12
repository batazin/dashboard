import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { tagSchema } from "@/lib/validations"

// GET /api/tags - List all tags
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(tags)
  } catch (error) {
    console.error("Error fetching tags:", error)
    return NextResponse.json({ error: "Erro ao buscar tags" }, { status: 500 })
  }
}

// POST /api/tags - Create new tag
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = tagSchema.parse(body)

    const existingTag = await prisma.tag.findUnique({
      where: { name: validatedData.name },
    })

    if (existingTag) {
      return NextResponse.json({ error: "Tag já existe" }, { status: 400 })
    }

    const tag = await prisma.tag.create({
      data: {
        name: validatedData.name,
        color: validatedData.color,
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error("Error creating tag:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro ao criar tag" }, { status: 500 })
  }
}

// DELETE /api/tags - Delete tag (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get("id")

    if (!tagId) {
      return NextResponse.json({ error: "ID da tag não fornecido" }, { status: 400 })
    }

    await prisma.tag.delete({ where: { id: tagId } })

    return NextResponse.json({ message: "Tag excluída com sucesso" })
  } catch (error) {
    console.error("Error deleting tag:", error)
    return NextResponse.json({ error: "Erro ao excluir tag" }, { status: 500 })
  }
}
