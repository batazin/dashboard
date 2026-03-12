import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { isValidFileType, isValidFileSize, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/utils"

// POST /api/upload - Upload file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const orderId = formData.get("orderId") as string | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo não fornecido" }, { status: 400 })
    }

    if (!orderId) {
      return NextResponse.json({ error: "ID do pedido não fornecido" }, { status: 400 })
    }

    // Validate file type
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido. Tipos aceitos: ${ALLOWED_FILE_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Verify order exists and user has access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { professional: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    const hasAccess =
      session.user.role === "ADMIN" ||
      order.requesterId === session.user.id ||
      (session.user.role === "PROFESSIONAL" && order.professional?.userId === session.user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Generate unique filename
    const ext = path.extname(file.name)
    const filename = `${uuidv4()}${ext}`
    
    // Create uploads directory if it doesn't exist
    const uploadDir = process.env.UPLOAD_DIR || "./uploads"
    const orderDir = path.join(uploadDir, orderId)
    await mkdir(orderDir, { recursive: true })

    // Save file
    const filepath = path.join(orderDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: `/api/uploads/${orderId}/${filename}`,
        orderId,
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 })
  }
}

// DELETE /api/upload - Delete file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get("id")

    if (!attachmentId) {
      return NextResponse.json({ error: "ID do anexo não fornecido" }, { status: 400 })
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { order: { include: { professional: true } } },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 })
    }

    // Check permissions
    const hasAccess =
      session.user.role === "ADMIN" ||
      attachment.order.requesterId === session.user.id ||
      (session.user.role === "PROFESSIONAL" && 
       attachment.order.professional?.userId === session.user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Delete file from disk
    const uploadDir = process.env.UPLOAD_DIR || "./uploads"
    const filepath = path.join(uploadDir, attachment.orderId, attachment.filename)
    
    try {
      const fs = await import("fs/promises")
      await fs.unlink(filepath)
    } catch {
      // File might not exist, continue anyway
    }

    // Delete from database
    await prisma.attachment.delete({ where: { id: attachmentId } })

    return NextResponse.json({ message: "Anexo excluído com sucesso" })
  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json({ error: "Erro ao excluir anexo" }, { status: 500 })
  }
}
