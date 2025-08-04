"use client"

import { useState } from "react"
import type { ImageArtifact } from "@/types/artifacts"
import { cn } from "@/lib/utils"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Download,
  Maximize2,
} from "lucide-react"
import Image from "next/image"

interface ImageViewerProps {
  artifact: ImageArtifact
  className?: string
}

export function ImageViewer({ artifact, className }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)

  const imageSrc = artifact.url || `data:image/${artifact.format};base64,${artifact.base64}`

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleFlipH = () => {
    setFlipH((prev) => !prev)
  }

  const handleFlipV = () => {
    setFlipV((prev) => !prev)
  }

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = imageSrc
    a.download = `${artifact.title}.${artifact.format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleFullscreen = () => {
    const img = document.querySelector(`#image-${artifact.id}`) as HTMLImageElement
    if (img && img.requestFullscreen) {
      img.requestFullscreen()
    }
  }

  const getTransform = () => {
    const transforms = []
    transforms.push(`scale(${zoom / 100})`)
    transforms.push(`rotate(${rotation}deg)`)
    if (flipH) transforms.push("scaleX(-1)")
    if (flipV) transforms.push("scaleY(-1)")
    return transforms.join(" ")
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {artifact.format.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {artifact.width} × {artifact.height}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {zoom}%
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 300}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </GlassButton>
          <div className="w-px h-6 bg-white/10" />
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleRotate}
            className="h-8 w-8"
          >
            <RotateCw className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleFlipH}
            className="h-8 w-8"
          >
            <FlipHorizontal className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleFlipV}
            className="h-8 w-8"
          >
            <FlipVertical className="h-4 w-4" />
          </GlassButton>
          <div className="w-px h-6 bg-white/10" />
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            className="h-8 w-8"
          >
            <Maximize2 className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Image Container */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <div
          className="relative transition-transform duration-300 ease-in-out"
          style={{
            transform: getTransform(),
            transformOrigin: "center",
          }}
        >
          {artifact.format === "svg" ? (
            <div
              id={`image-${artifact.id}`}
              dangerouslySetInnerHTML={{ __html: artifact.content }}
              className="max-w-full max-h-full"
            />
          ) : (
            <Image
              id={`image-${artifact.id}`}
              src={imageSrc}
              alt={artifact.title}
              width={artifact.width}
              height={artifact.height}
              className="max-w-full max-h-full object-contain"
              style={{
                imageRendering:
                  zoom > 100 ? "pixelated" : "auto",
              }}
              unoptimized={imageSrc.startsWith("data:")}
            />
          )}
        </div>
      </div>
    </div>
  )
}