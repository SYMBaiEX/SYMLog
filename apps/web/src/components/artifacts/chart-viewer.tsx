'use client';

import { Download, Maximize2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { cn } from '@/lib/utils';
import type { ChartArtifact } from '@/types/artifacts';

interface ChartViewerProps {
  artifact: ChartArtifact;
  className?: string;
}

export function ChartViewer({ artifact, className }: ChartViewerProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const loadChart = async () => {
      if (typeof window !== 'undefined' && chartRef.current) {
        // Dynamically import Chart.js
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        // Destroy existing chart
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        // Create new chart
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          chartInstanceRef.current = new Chart(ctx, {
            type: artifact.chartType as any,
            data: artifact.data,
            options: {
              ...artifact.options,
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                ...artifact.options?.plugins,
                legend: {
                  ...artifact.options?.plugins?.legend,
                  labels: {
                    ...artifact.options?.plugins?.legend?.labels,
                    color: 'rgba(255, 255, 255, 0.8)',
                  },
                },
                title: {
                  ...artifact.options?.plugins?.title,
                  color: 'rgba(255, 255, 255, 0.9)',
                },
              },
              scales:
                artifact.chartType !== 'pie'
                  ? {
                      x: {
                        ...artifact.options?.scales?.x,
                        ticks: {
                          ...artifact.options?.scales?.x?.ticks,
                          color: 'rgba(255, 255, 255, 0.6)',
                        },
                        grid: {
                          ...artifact.options?.scales?.x?.grid,
                          color: 'rgba(255, 255, 255, 0.1)',
                        },
                      },
                      y: {
                        ...artifact.options?.scales?.y,
                        ticks: {
                          ...artifact.options?.scales?.y?.ticks,
                          color: 'rgba(255, 255, 255, 0.6)',
                        },
                        grid: {
                          ...artifact.options?.scales?.y?.grid,
                          color: 'rgba(255, 255, 255, 0.1)',
                        },
                      },
                    }
                  : undefined,
            },
          });
        }
      }
    };

    loadChart();

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [artifact]);

  const downloadChart = () => {
    if (chartRef.current) {
      const url = chartRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.title}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const fullscreenChart = () => {
    if (chartRef.current && chartRef.current.requestFullscreen) {
      chartRef.current.requestFullscreen();
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-white/10 border-b p-4">
        <div className="flex items-center gap-2">
          <Badge className="text-xs capitalize" variant="secondary">
            {artifact.chartType} Chart
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            className="h-8 w-8"
            onClick={fullscreenChart}
            size="icon"
            variant="ghost"
          >
            <Maximize2 className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            className="h-8 w-8"
            onClick={downloadChart}
            size="icon"
            variant="ghost"
          >
            <Download className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 p-4">
        <canvas
          className="h-full w-full"
          ref={chartRef}
          style={{ maxHeight: '100%' }}
        />
      </div>
    </div>
  );
}
