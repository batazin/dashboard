import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { registerSchema } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email já está em uso" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
      },
    })

    // If registering as professional, create professional profile
    if (validatedData.role === "PROFESSIONAL") {
      await prisma.professional.create({
        data: {
          userId: user.id,
          specialty: "A definir",
          skills: [],
        }
      })
    }

    return NextResponse.json(
      { 
        message: "Usuário criado com sucesso",
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao criar usuário" },
      { status: 500 }
    )
  }
}
