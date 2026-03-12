import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import prisma from "@/lib/prisma"

type RouteParams = { params: Promise<{ orderId: string; filename: string }> }

// GET /api/uploads/[orderId]/[filename] - Serve uploaded files
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orderId, filename } = await params

    // Verify attachment exists
    const attachment = await prisma.attachment.findFirst({
      where: {
        orderId,
        filename,
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 })
    }

    const uploadDir = process.env.UPLOAD_DIR || "./uploads"
    const filepath = path.join(uploadDir, orderId, filename)

    try {
      const fileBuffer = await readFile(filepath)
      
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Disposition": `inline; filename="${attachment.originalName}"`,
          "Cache-Control": "public, max-age=31536000",
        },
      })
    } catch {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 })
    }
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json({ error: "Erro ao servir arquivo" }, { status: 500 })
  }
}
