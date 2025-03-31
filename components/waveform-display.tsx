"use client"

import { useRef, useEffect } from "react"

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer
  width: number
  height: number
  color?: string
}

export function WaveformDisplay({ audioBuffer, width, height, color = "white" }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get audio data
    const channelData = audioBuffer.getChannelData(0)
    const step = Math.ceil(channelData.length / width)

    // Draw waveform
    ctx.beginPath()
    ctx.moveTo(0, height / 2)

    for (let i = 0; i < width; i++) {
      const dataIndex = Math.floor(i * step)
      const value = channelData[dataIndex] || 0
      const y = (0.5 + value * 0.5) * height
      ctx.lineTo(i, y)
    }

    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.stroke()
  }, [audioBuffer, width, height, color])

  return <canvas ref={canvasRef} width={width} height={height} className="w-full h-full" />
}

