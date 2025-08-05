'use client';

import {
  Download,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { cn } from '@/lib/utils';
import type { ImageArtifact } from '@/types/artifacts';

interface ImageViewerProps {
  artifact: ImageArtifact;
  className?: string;
}

export function ImageViewer({ artifact, className }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const imageSrc =
    artifact.url || `data:image/${artifact.format};base64,${artifact.base64}`;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFlipH = () => {
    setFlipH((prev) => !prev);
  };

  const handleFlipV = () => {
    setFlipV((prev) => !prev);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = `${artifact.title}.${artifact.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFullscreen = () => {
    const img = document.querySelector(
      `#image-${artifact.id}`
    ) as HTMLImageElement;
    if (img && img.requestFullscreen) {
      img.requestFullscreen();
    }
  };

  const getTransform = () => {
    const transforms = [];
    transforms.push(`scale(${zoom / 100})`);
    transforms.push(`rotate(${rotation}deg)`);
    if (flipH) transforms.push('scaleX(-1)');
    if (flipV) transforms.push('scaleY(-1)');
    return transforms.join(' ');
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-white/10 border-b p-4">
        <div className="flex items-center gap-2">
          <Badge className="text-xs" variant="secondary">
            {artifact.format.toUpperCase()}
          </Badge>
          <Badge className="text-xs" variant="outline">
            {artifact.width} × {artifact.height}
          </Badge>
          <Badge className="text-xs" variant="outline">
            {zoom}%
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            className="h-8 w-8"
            disabled={zoom <= 25}
            onClick={handleZoomOut}
            size="icon"
            variant="ghost"
          >
            <ZoomOut className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            className="h-8 w-8"
            disabled={zoom >= 300}
            onClick={handleZoomIn}
            size="icon"
            variant="ghost"
          >
            <ZoomIn className="h-4 w-4" />
          </GlassButton>
          <div className="h-6 w-px bg-white/10" />
          <GlassButton
            className="h-8 w-8"
            onClick={handleRotate}
            size="icon"
            variant="ghost"
          >
            <RotateCw className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            className="h-8 w-8"
            onClick={handleFlipH}
            size="icon"
            variant="ghost"
          >
            <FlipHorizontal className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            className="h-8 w-8"
            onClick={handleFlipV}
            size="icon"
            variant="ghost"
          >
            <FlipVertical className="h-4 w-4" />
          </GlassButton>
          <div className="h-6 w-px bg-white/10" />
          <GlassButton
            className="h-8 w-8"
            onClick={handleFullscreen}
            size="icon"
            variant="ghost"
          >
            <Maximize2 className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            className="h-8 w-8"
            onClick={handleDownload}
            size="icon"
            variant="ghost"
          >
            <Download className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Image Container */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <div
          className="relative transition-transform duration-300 ease-in-out"
          style={{
            transform: getTransform(),
            transformOrigin: 'center',
          }}
        >
          {artifact.format === 'svg' ? (
            <div
              className="max-h-full max-w-full"
              dangerouslySetInnerHTML={{ __html: artifact.content }}
              id={`image-${artifact.id}`}
            />
          ) : (
            <Image
              alt={artifact.title}
              className="max-h-full max-w-full object-contain"
              height={artifact.height}
              id={`image-${artifact.id}`}
              src={imageSrc}
              style={{
                imageRendering: zoom > 100 ? 'pixelated' : 'auto',
              }}
              unoptimized={imageSrc.startsWith('data:')}
              width={artifact.width}
            />
          )}
        </div>
      </div>
    </div>
  );
}
