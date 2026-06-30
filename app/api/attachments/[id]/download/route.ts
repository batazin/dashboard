import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase"

type RouteParams = { params: Promise<{ id: string }> }

function contentDispositionFilename(filename: string) {
  const fallback = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")

  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )

  return `attachment; filename="${fallback || "arquivo"}"; filename*=UTF-8''${encoded}`
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { order: { include: { professional: true } } },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 })
    }

    const hasAccess =
      session.user.role === "ADMIN" ||
      attachment.order.requesterId === session.user.id ||
      (session.user.role === "PROFESSIONAL" &&
        attachment.order.professional?.userId === session.user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Armazenamento indisponível" }, { status: 503 })
    }

    const filePath = `${attachment.orderId}/${attachment.filename}`
    const { data, error } = await supabaseAdmin.storage
      .from("attachments")
      .download(filePath)

    if (error || !data) {
      console.error("Supabase download error:", error)
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 })
    }

    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(data.size),
        "Content-Disposition": contentDispositionFilename(attachment.originalName),
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Error downloading attachment:", error)
    return NextResponse.json({ error: "Erro ao baixar anexo" }, { status: 500 })
  }
}
