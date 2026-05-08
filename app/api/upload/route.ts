import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"
import { isValidFileType, isValidFileSize, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/utils"
import { supabaseAdmin } from "@/lib/supabase"

// POST /api/upload - Upload file to Supabase Storage
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

    // Generate unique filename and path
    const fileExt = file.name.split('.').pop()
    const filename = `${uuidv4()}.${fileExt}`
    const filePath = `${orderId}/${filename}`
    
    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('attachments')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      return NextResponse.json({ error: `Erro ao fazer upload para o Storage: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('attachments')
      .getPublicUrl(filePath)

    // Create attachment record
    try {
      const attachment = await prisma.attachment.create({
        data: {
          filename,
          originalName: file.name || "pasted-image",
          mimeType: file.type,
          size: file.size,
          url: publicUrl,
          orderId,
        },
      })

      return NextResponse.json(attachment, { status: 201 })
    } catch (err: any) {
      console.error("Error creating attachment record:", err)
      // Cleanup: delete from storage if DB record fails
      await supabaseAdmin.storage.from('attachments').remove([filePath])
      return NextResponse.json({ error: `Erro ao registrar anexo no banco de dados: ${err.message}` }, { status: 500 })
    }

  } catch (error: any) {
    console.error("Critical error uploading file:", error)
    return NextResponse.json({ 
      error: "Erro inesperado ao fazer upload", 
      details: error.message 
    }, { status: 500 })
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

    // Delete file from Supabase Storage
    const filePath = `${attachment.orderId}/${attachment.filename}`
    
    try {
      const { error: deleteError } = await supabaseAdmin.storage
        .from('attachments')
        .remove([filePath])
      
      if (deleteError) {
        console.warn("Error deleting from Supabase Storage:", deleteError)
      }
    } catch (err) {
      console.error("Critical error deleting from storage:", err)
    }

    // Delete from database
    await prisma.attachment.delete({ where: { id: attachmentId } })

    return NextResponse.json({ message: "Anexo excluído com sucesso" })

  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json({ error: "Erro ao excluir anexo" }, { status: 500 })
  }
}
