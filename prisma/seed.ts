import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting seed...")

  // Clean database
  await prisma.statusHistory.deleteMany()
  await prisma.message.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.professional.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log("🗑️ Cleaned database")

  const hashedPassword = await bcrypt.hash("senha123", 10)

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@example.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  })
  console.log("👤 Created admin user")

  // Create requester users
  const requester1 = await prisma.user.create({
    data: {
      name: "João Silva",
      email: "joao@example.com",
      password: hashedPassword,
      role: "REQUESTER",
    },
  })

  const requester2 = await prisma.user.create({
    data: {
      name: "Maria Santos",
      email: "maria@example.com",
      password: hashedPassword,
      role: "REQUESTER",
    },
  })
  console.log("👤 Created requester users")

  // Create professional users
  const professionals = await Promise.all([
    prisma.user.create({
      data: {
        name: "Carlos Dev",
        email: "carlos@example.com",
        password: hashedPassword,
        role: "PROFESSIONAL",
        professional: {
          create: {
            specialty: "Desenvolvedor Full Stack",
            skills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
            status: "AVAILABLE",
            bio: "Desenvolvedor com 5 anos de experiência em web development.",
          },
        },
      },
      include: { professional: true },
    }),
    prisma.user.create({
      data: {
        name: "Ana Designer",
        email: "ana@example.com",
        password: hashedPassword,
        role: "PROFESSIONAL",
        professional: {
          create: {
            specialty: "UI/UX Designer",
            skills: ["Figma", "Adobe XD", "CSS", "Design Systems"],
            status: "AVAILABLE",
            bio: "Designer especializada em interfaces web e mobile.",
          },
        },
      },
      include: { professional: true },
    }),
    prisma.user.create({
      data: {
        name: "Pedro Mobile",
        email: "pedro@example.com",
        password: hashedPassword,
        role: "PROFESSIONAL",
        professional: {
          create: {
            specialty: "Desenvolvedor Mobile",
            skills: ["React Native", "Flutter", "iOS", "Android"],
            status: "BUSY",
            bio: "Desenvolvedor mobile com foco em React Native.",
          },
        },
      },
      include: { professional: true },
    }),
    prisma.user.create({
      data: {
        name: "Lucia Backend",
        email: "lucia@example.com",
        password: hashedPassword,
        role: "PROFESSIONAL",
        professional: {
          create: {
            specialty: "Desenvolvedora Backend",
            skills: ["Python", "Django", "FastAPI", "PostgreSQL", "Redis"],
            status: "AVAILABLE",
            bio: "Backend developer com experiência em APIs escaláveis.",
          },
        },
      },
      include: { professional: true },
    }),
    prisma.user.create({
      data: {
        name: "Roberto DevOps",
        email: "roberto@example.com",
        password: hashedPassword,
        role: "PROFESSIONAL",
        professional: {
          create: {
            specialty: "DevOps Engineer",
            skills: ["Docker", "Kubernetes", "AWS", "CI/CD", "Terraform"],
            status: "UNAVAILABLE",
            bio: "Especialista em infraestrutura e automação.",
          },
        },
      },
      include: { professional: true },
    }),
  ])
  console.log("👤 Created 5 professional users")

  // Create tags
  const tagNames = [
    "Anestesio",
    "Aulas",
    "Cardio",
    "Clinicof",
    "Cirurgia",
    "Derma",
    "Usa",
    "Mentoria",
    "Extensivo",
    "Revalida",
    "Endócrino",
    "Oftalmo",
    "Pediatria",
    "G.O",
    "Hands",
    "Hiit Target",
    "Hiit",
    "Radio",
    "Temi",
    "Home",
    "Eventos",
    "Urologia",
    "Concursus",
    "Black November",
    "Outros",
  ]

  const colors = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#db2777",
    "#fb7185",
    "#6366f1",
    "#4b5563",
    "#0ea5a4",
    "#a78bfa",
    "#60a5fa",
    "#f472b6",
    "#10b981",
    "#64748b",
    "#7c3aed",
    "#b91c1c",
    "#111827",
  ]

  const tags = await Promise.all(
    tagNames.map((name, i) =>
      prisma.tag.create({ data: { name, color: colors[i % colors.length] } }),
    ),
  )
  console.log("🏷️ Created tags")

  // Create orders
  const orders = await Promise.all([
    // Order 1 - New
    prisma.order.create({
      data: {
        title: "Desenvolver landing page",
        description: "Criar uma landing page responsiva para o novo produto. Deve incluir seções: hero, features, pricing, testimonials e footer.",
        priority: "HIGH",
        status: "NEW",
        requesterId: requester1.id,
        statusHistory: {
          create: {
            toStatus: "NEW",
            changedById: requester1.id,
            observation: "Pedido criado",
          },
        },
      },
    }),
    // Order 2 - In Analysis
    prisma.order.create({
      data: {
        title: "Corrigir bug no login",
        description: "Usuários estão reportando erro 500 ao tentar fazer login com email contendo caracteres especiais.",
        priority: "URGENT",
        status: "IN_ANALYSIS",
        requesterId: requester1.id,
        professionalId: professionals[0].professional!.id,
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester1.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_ANALYSIS",
              changedById: professionals[0].id,
              observation: "Iniciando análise do problema",
            },
          ],
        },
      },
    }),
    // Order 3 - In Progress
    prisma.order.create({
      data: {
        title: "Redesign do dashboard",
        description: "Atualizar o design do dashboard principal com novo layout e melhor organização das informações.",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        requesterId: requester2.id,
        professionalId: professionals[1].professional!.id,
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester2.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_ANALYSIS",
              changedById: professionals[1].id,
              observation: "Analisando requisitos de design",
            },
            {
              fromStatus: "IN_ANALYSIS",
              toStatus: "IN_PROGRESS",
              changedById: professionals[1].id,
              observation: "Iniciando trabalho no Figma",
            },
          ],
        },
      },
    }),
    // Order 4 - Waiting Client
    prisma.order.create({
      data: {
        title: "API de integração com pagamentos",
        description: "Desenvolver API REST para integração com gateway de pagamentos. Suportar PIX, cartão de crédito e boleto.",
        priority: "HIGH",
        status: "WAITING_CLIENT",
        requesterId: requester1.id,
        professionalId: professionals[3].professional!.id,
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester1.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_PROGRESS",
              changedById: professionals[3].id,
              observation: "Desenvolvimento iniciado",
            },
            {
              fromStatus: "IN_PROGRESS",
              toStatus: "WAITING_CLIENT",
              changedById: professionals[3].id,
              observation: "Aguardando credenciais do gateway de pagamentos",
            },
          ],
        },
      },
    }),
    // Order 5 - Finished
    prisma.order.create({
      data: {
        title: "App mobile de notificações",
        description: "Desenvolver aplicativo mobile para receber notificações push do sistema.",
        priority: "MEDIUM",
        status: "FINISHED",
        requesterId: requester2.id,
        professionalId: professionals[2].professional!.id,
        feedback: "Excelente trabalho! O app ficou muito bom e as notificações funcionam perfeitamente.",
        rating: 5,
        finishedAt: new Date(),
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester2.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_PROGRESS",
              changedById: professionals[2].id,
              observation: "Iniciando desenvolvimento",
            },
            {
              fromStatus: "IN_PROGRESS",
              toStatus: "FINISHED",
              changedById: professionals[2].id,
              observation: "App finalizado e testado",
            },
          ],
        },
      },
    }),
    // Order 6 - Cancelled
    prisma.order.create({
      data: {
        title: "Sistema de chat ao vivo",
        description: "Implementar sistema de chat ao vivo para suporte ao cliente.",
        priority: "LOW",
        status: "CANCELLED",
        requesterId: requester1.id,
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester1.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "CANCELLED",
              changedById: requester1.id,
              observation: "Projeto cancelado - mudança de prioridades",
            },
          ],
        },
      },
    }),
    // Order 7 - New
    prisma.order.create({
      data: {
        title: "Documentação da API",
        description: "Criar documentação completa da API usando Swagger/OpenAPI.",
        priority: "LOW",
        status: "NEW",
        requesterId: requester2.id,
        statusHistory: {
          create: {
            toStatus: "NEW",
            changedById: requester2.id,
            observation: "Pedido criado",
          },
        },
      },
    }),
    // Order 8 - In Progress
    prisma.order.create({
      data: {
        title: "Configurar CI/CD",
        description: "Configurar pipeline de CI/CD com GitHub Actions para deploy automático.",
        priority: "HIGH",
        status: "IN_PROGRESS",
        requesterId: requester1.id,
        professionalId: professionals[4].professional!.id,
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester1.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_PROGRESS",
              changedById: professionals[4].id,
              observation: "Configurando workflows",
            },
          ],
        },
      },
    }),
    // Order 9 - Finished
    prisma.order.create({
      data: {
        title: "Otimização de performance",
        description: "Otimizar queries do banco de dados e melhorar tempo de resposta da API.",
        priority: "MEDIUM",
        status: "FINISHED",
        requesterId: requester2.id,
        professionalId: professionals[3].professional!.id,
        feedback: "Performance melhorou significativamente. Tempo de resposta reduziu 70%.",
        rating: 4,
        finishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester2.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_PROGRESS",
              changedById: professionals[3].id,
              observation: "Analisando queries",
            },
            {
              fromStatus: "IN_PROGRESS",
              toStatus: "FINISHED",
              changedById: professionals[3].id,
              observation: "Otimizações aplicadas e testadas",
            },
          ],
        },
      },
    }),
    // Order 10 - In Analysis
    prisma.order.create({
      data: {
        title: "Implementar autenticação 2FA",
        description: "Adicionar autenticação de dois fatores via SMS ou app authenticator.",
        priority: "HIGH",
        status: "IN_ANALYSIS",
        requesterId: requester1.id,
        professionalId: professionals[0].professional!.id,
        statusHistory: {
          create: [
            {
              toStatus: "NEW",
              changedById: requester1.id,
              observation: "Pedido criado",
            },
            {
              fromStatus: "NEW",
              toStatus: "IN_ANALYSIS",
              changedById: professionals[0].id,
              observation: "Avaliando bibliotecas e métodos de implementação",
            },
          ],
        },
      },
    }),
  ])
  console.log("📋 Created 10 orders")

  // Add some messages to orders
  await prisma.message.createMany({
    data: [
      {
        content: "Olá! Vi que você assumiu o pedido. Alguma dúvida sobre os requisitos?",
        orderId: orders[1].id,
        userId: requester1.id,
      },
      {
        content: "Sim, preciso saber qual versão do Node.js está sendo usada no servidor.",
        orderId: orders[1].id,
        userId: professionals[0].id,
      },
      {
        content: "Estamos usando Node.js 18 LTS.",
        orderId: orders[1].id,
        userId: requester1.id,
      },
      {
        content: "Perfeito, obrigado! Vou começar a análise.",
        orderId: orders[1].id,
        userId: professionals[0].id,
      },
      {
        content: "Gostaria de revisar os protótipos antes de começar?",
        orderId: orders[2].id,
        userId: professionals[1].id,
      },
      {
        content: "Sim, por favor! Pode me enviar pelo Figma.",
        orderId: orders[2].id,
        userId: requester2.id,
      },
    ],
  })
  console.log("💬 Created messages")

  console.log("✅ Seed completed!")
  console.log("")
  console.log("📧 Test accounts:")
  console.log("   Admin: admin@example.com / senha123")
  console.log("   Requester: joao@example.com / senha123")
  console.log("   Professional: carlos@example.com / senha123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
