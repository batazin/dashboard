import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = "guhzinho2016@gmail.com"
  const password = "_senha_"
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: "ADMIN",
      },
      create: {
        name: "Gustavo Admin",
        email,
        password: hashedPassword,
        role: "ADMIN",
      },
    })
    console.log("✅ Usuário administrador criado/atualizado com sucesso!")
    console.log("📧 Email:", user.email)
    console.log("🔑 Senha: _senha_")
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
