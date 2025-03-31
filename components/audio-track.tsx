"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Volume2, VolumeX, Music, Trash2, Upload, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

interface Track {
  id: string
  name: string
  audioBuffer: AudioBuffer | null
  color: string
  muted: boolean
  solo: boolean
  volume: number
  position?: number // Position in seconds where the track starts
}

interface AudioTrackProps {
  track: Track
  currentTime: number
  zoom: number
  bpm: number
  onUpdate: (updates: Partial<Track>) => void
  onRemove: () => void
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>, trackId?: string) => void
}

export function AudioTrack({ track, currentTime, zoom, bpm, onUpdate, onRemove, onFileUpload }: AudioTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingWaveform, setIsDraggingWaveform] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [initialPosition, setInitialPosition] = useState(track.position || 0)
  const [snapToGrid, setSnapToGrid] = useState(true)

  // Initialize position if not set
  useEffect(() => {
    if (track.position === undefined) {
      onUpdate({ position: 0 });
    }
  }, []);

  // Draw waveform - now responds to zoom changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !track.audioBuffer) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Update canvas width based on zoom
    canvas.width = track.audioBuffer.duration * zoom;
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get audio data
    const channelData = track.audioBuffer.getChannelData(0)
    const step = Math.ceil(channelData.length / width)

    // Set colors
    const waveColor = track.color.replace("bg-", "")
    
    // Fill background with solid color matching the header
    ctx.fillStyle = `rgb(var(--${waveColor}))`;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, 0, width, height);
    
    // Draw darker background in the middle
    ctx.fillStyle = 'rgba(30, 30, 30, 0.5)';
    ctx.globalAlpha = 1;
    ctx.fillRect(0, height * 0.1, width, height * 0.8);
    
    // Draw waveform
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;

    // Use a more detailed approach to draw the waveform
    const midPoint = height / 2;
    
    // Draw the waveform
    ctx.beginPath()
    
    for (let i = 0; i < width; i++) {
      const startIdx = Math.floor(i * step)
      const endIdx = Math.floor((i + 1) * step)

      // Find min and max values in this segment
      let min = 0
      let max = 0

      for (let j = startIdx; j < endIdx; j++) {
        if (j < channelData.length) {
          const value = channelData[j]
          if (value < min) min = value
          if (value > max) max = value
        }
      }

      // Draw a vertical line from min to max
      const y1 = midPoint + min * midPoint * 0.8
      const y2 = midPoint + max * midPoint * 0.8

      ctx.moveTo(i, y1)
      ctx.lineTo(i, y2)
    }
    
    ctx.stroke()
    
    // Add highlight effect for waveform peaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    
    for (let i = 0; i < width; i += 2) {
      const startIdx = Math.floor(i * step)
      const endIdx = Math.floor((i + 1) * step)
      
      // Find average value in this segment
      let sum = 0;
      let count = 0;
      
      for (let j = startIdx; j < endIdx; j++) {
        if (j < channelData.length) {
          sum += Math.abs(channelData[j]);
          count++;
        }
      }
      
      const avg = count > 0 ? sum / count : 0;
      const barHeight = avg * height * 0.7;
      
      ctx.fillRect(i, midPoint - barHeight/2, 1, barHeight);
    }
  }, [track.audioBuffer, track.color, zoom]) // Add zoom to dependencies

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFileUpload(event, track.id)
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Snap to grid helper function
  const snapPositionToGrid = (position: number) => {
    if (!snapToGrid) return position;
    
    // Calculate beat duration in seconds
    const beatDuration = 60 / bpm;
    
    // Calculate how many beats this position represents
    const beats = position / beatDuration;
    
    // Round to nearest beat
    const snappedBeats = Math.round(beats);
    
    // Convert back to seconds
    return snappedBeats * beatDuration;
  };

  // Drag handlers for repositioning track
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setInitialPosition(track.position || 0);
    
    // Add event listeners for drag and drop
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    
    // Prevent default behavior to avoid issues
    e.preventDefault();
  };
  
  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    // Calculate the drag distance in pixels
    const deltaX = e.clientX - dragStartX;
    
    // Convert to time units based on the zoom level
    const deltaTime = deltaX / zoom;
    
    // Update track position (but don't allow negative positions)
    const newPosition = Math.max(0, initialPosition + deltaTime);
    onUpdate({ position: newPosition });
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Snap to grid when drag ends
    if (track.position !== undefined) {
      const snappedPosition = snapPositionToGrid(track.position);
      if (snappedPosition !== track.position) {
        onUpdate({ position: snappedPosition });
      }
    }
    
    // Clean up event listeners
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
  };

  // Drag handlers for waveform (audio clip)
  const handleWaveformDragStart = (e: React.MouseEvent) => {
    if (!track.audioBuffer) return;
    
    setIsDraggingWaveform(true);
    setDragStartX(e.clientX);
    setInitialPosition(track.position || 0);
    
    // Add event listeners for drag and drop
    document.addEventListener("mousemove", handleWaveformDragMove);
    document.addEventListener("mouseup", handleWaveformDragEnd);
    
    // Prevent default behavior
    e.preventDefault();
    
    // Add active class to show it's being dragged
    if (waveformRef.current) {
      waveformRef.current.classList.add('ring-2', 'ring-primary');
      waveformRef.current.style.cursor = 'grabbing';
      waveformRef.current.style.opacity = '0.8';
      waveformRef.current.style.zIndex = '10';
    }
  };
  
  const handleWaveformDragMove = (e: MouseEvent) => {
    if (!isDraggingWaveform || !waveformRef.current) return;
    
    // Calculate the drag distance in pixels
    const deltaX = e.clientX - dragStartX;
    
    // Convert to time units based on the zoom level
    const deltaTime = deltaX / zoom;
    
    // Update track position (but don't allow negative positions)
    const newPosition = Math.max(0, initialPosition + deltaTime);
    
    // Show ghost position if snapping
    if (snapToGrid && waveformRef.current) {
      const snappedPosition = snapPositionToGrid(newPosition);
      const snapDifference = snappedPosition - newPosition;
      
      // Visual indicator of where it will snap to
      waveformRef.current.style.boxShadow = `${snapDifference * zoom}px 0 0 rgba(var(--primary), 0.5)`;
    }
    
    // Update position in real-time to show movement
    onUpdate({ position: newPosition });
  };
  
  const handleWaveformDragEnd = () => {
    setIsDraggingWaveform(false);
    
    // Remove visual styling
    if (waveformRef.current) {
      waveformRef.current.style.boxShadow = '';
      waveformRef.current.classList.remove('ring-2', 'ring-primary');
      waveformRef.current.style.cursor = 'move';
      waveformRef.current.style.opacity = '1';
      waveformRef.current.style.zIndex = 'auto';
    }
    
    // Snap to grid when drag ends
    if (track.position !== undefined) {
      const snappedPosition = snapPositionToGrid(track.position);
      if (snappedPosition !== track.position) {
        onUpdate({ position: snappedPosition });
      }
    }
    
    // Clean up event listeners
    document.removeEventListener("mousemove", handleWaveformDragMove);
    document.removeEventListener("mouseup", handleWaveformDragEnd);
  };

  return (
    <div ref={trackRef} className="flex h-24 border-b">
      {/* Track Controls */}
      <div className="flex flex-col w-48 p-2 border-r bg-muted/20">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("w-3 h-3 rounded-full", track.color)} />
          <Input value={track.name} onChange={(e) => onUpdate({ name: e.target.value })} className="h-7 text-sm" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdate({ muted: !track.muted })}>
            {track.muted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          <Slider
            value={[track.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(value) => onUpdate({ volume: value[0] })}
            className="flex-1"
            disabled={track.muted}
          />
        </div>

        <div className="flex items-center gap-1 mt-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUploadClick}>
            <Upload className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 cursor-move" 
            onMouseDown={handleDragStart}
          >
            <GripVertical className="h-4 w-4" />
          </Button>

          <Button
            variant={snapToGrid ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setSnapToGrid(!snapToGrid)}
            title={snapToGrid ? "Snap to Grid: On" : "Snap to Grid: Off"}
          >
            <span className="text-xs font-bold">⧉</span>
          </Button>

          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
        </div>
      </div>

      {/* Track Content */}
      <div className="relative flex-1 bg-muted/10 overflow-hidden">
        {track.audioBuffer ? (
          <div 
            ref={waveformRef}
            className={cn(
              "h-full cursor-move rounded overflow-hidden border",
              track.color.replace("bg-", "border-")
            )}
            style={{ 
              position: 'absolute', 
              left: `${(track.position || 0) * zoom}px`,
              width: `${track.audioBuffer.duration * zoom}px`,
              transition: isDraggingWaveform ? 'none' : 'box-shadow 0.1s ease'
            }}
            onMouseDown={handleWaveformDragStart}
            title="Drag to reposition audio clip"
          >
            {/* Audio clip label */}
            <div 
              className={cn(
                "absolute top-0 left-0 right-0 px-2 py-1 text-xs truncate z-10 flex items-center",
                track.color
              )}
            >
              <span className="text-white font-medium">{track.name}</span>
              {track.audioBuffer?.duration && (
                <span className="ml-auto text-white/80 text-xs">
                  {Math.floor(track.audioBuffer.duration * 10) / 10}s
                </span>
              )}
            </div>
            
            <canvas
              ref={canvasRef}
              width={track.audioBuffer.duration * zoom}
              height={96}
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Music className="h-5 w-5 mr-2" />
            <span>Click the upload button to add audio</span>
          </div>
        )}
      </div>
    </div>
  )
}

