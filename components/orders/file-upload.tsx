"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, X, FileIcon, Image, FileText } from "lucide-react"
import { cn, formatFileSize, isValidFileType, isValidFileSize, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface FileUploadProps {
  orderId?: string
  onUploadComplete?: (attachment: any) => void
  existingAttachments?: any[]
  onRemove?: (attachmentId: string) => void
}

export function FileUpload({ orderId, onUploadComplete, existingAttachments = [], onRemove }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!orderId) return

    setError(null)
    setUploading(true)

    for (const file of acceptedFiles) {
      if (!isValidFileType(file.type)) {
        setError(`Tipo de arquivo não permitido: ${file.type}`)
        continue
      }

      if (!isValidFileSize(file.size)) {
        setError(`Arquivo muito grande: ${formatFileSize(file.size)}. Máximo: ${formatFileSize(MAX_FILE_SIZE)}`)
        continue
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("orderId", orderId)

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Erro ao fazer upload")
        }

        const attachment = await response.json()
        onUploadComplete?.(attachment)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao fazer upload")
      }
    }

    setUploading(false)
  }, [orderId, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: !orderId || uploading,
  })

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image
    if (mimeType.includes("pdf")) return FileText
    return FileIcon
  }

  const handleRemove = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/upload?id=${attachmentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Erro ao remover arquivo")
      }

      onRemove?.(attachmentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover arquivo")
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-gray-400",
          (!orderId || uploading) && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        {isDragActive ? (
          <p className="text-sm text-gray-600">Solte os arquivos aqui...</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Arraste arquivos ou clique para selecionar
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, imagens, documentos (máx. 10MB)
            </p>
          </>
        )}
        {uploading && <p className="text-sm text-indigo-600 mt-2">Enviando...</p>}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {existingAttachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Arquivos anexados:</p>
          <div className="space-y-2">
            {existingAttachments.map((attachment) => {
              const Icon = getFileIcon(attachment.mimeType)
              return (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-gray-400" />
                    <div>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        {attachment.originalName}
                      </a>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-600"
                    onClick={() => handleRemove(attachment.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
