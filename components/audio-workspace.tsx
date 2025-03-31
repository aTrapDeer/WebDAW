"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Square, Plus } from "lucide-react"
import { AudioTrack } from "@/components/audio-track"
import { cn } from "@/lib/utils"

interface Track {
  id: string
  name: string
  audioBuffer: AudioBuffer | null
  color: string
  muted: boolean
  solo: boolean
  volume: number
  position?: number // Position in seconds
}

const COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
]

export function AudioWorkspace() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(50)
  const [bpm, setBpm] = useState(140)
  const [isLooping, setIsLooping] = useState(true)

  const audioContext = useRef<AudioContext | null>(null)
  const sourceNodes = useRef<Map<string, AudioBufferSourceNode>>(new Map())
  const gainNodes = useRef<Map<string, GainNode>>(new Map())
  const animationRef = useRef<number | null>(null)
  const startTime = useRef<number>(0)
  const pausedAt = useRef<number>(0)

  // Restart playback when BPM changes - using a ref to avoid circular dependencies
  const bpmRef = useRef(bpm);
  
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    if (isPlaying) {
      const savedPosition = pausedAt.current;
      stopPlayback(false);
      startPlayback();
    }
  }, [bpm, isPlaying]);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined" && !audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    return () => {
      if (audioContext.current) {
        audioContext.current.close()
      }
    }
  }, [])

  // Update duration based on tracks, accounting for positions
  useEffect(() => {
    if (tracks.length === 0) {
      setDuration(60) // Default 60 seconds when no tracks
      return
    }

    // Calculate max duration including track positions
    const maxDuration = Math.max(
      ...tracks
        .filter((track) => track.audioBuffer)
        .map((track) => (track.position || 0) + (track.audioBuffer?.duration || 0)),
      60 // Minimum 60 seconds
    )

    setDuration(maxDuration)
  }, [tracks])

  // Animation loop for playback position
  useEffect(() => {
    if (isPlaying) {
      const updatePlayhead = () => {
        if (audioContext.current) {
          const elapsed = audioContext.current.currentTime - startTime.current
          const newCurrentTime = pausedAt.current + elapsed;
          setCurrentTime(newCurrentTime)

          // Check if any tracks need to start playing because we've reached their position
          tracks.forEach((track) => {
            const trackPosition = track.position || 0;
            
            // If the track should start now and isn't already playing
            if (track.audioBuffer && 
                trackPosition > pausedAt.current && 
                trackPosition <= newCurrentTime && 
                !sourceNodes.current.has(track.id)) {
              
              // Create and start a new source for this track
              const source = audioContext.current!.createBufferSource();
              source.buffer = track.audioBuffer;
              source.playbackRate.value = bpm / 140;
              
              const gainNode = audioContext.current!.createGain();
              gainNode.gain.value = track.muted ? 0 : track.volume;
              
              source.connect(gainNode);
              gainNode.connect(audioContext.current!.destination);
              
              // Start from the beginning of the track
              source.start(0, 0);
              
              // Store the nodes
              sourceNodes.current.set(track.id, source);
              gainNodes.current.set(track.id, gainNode);
            }
          });

          if (newCurrentTime >= duration) {
            if (isLooping) {
              // If looping is enabled, restart playback
              pausedAt.current = 0;
              stopPlayback(false);
              startPlayback();
            } else {
              stopPlayback();
            }
            return;
          }
        }
        animationRef.current = requestAnimationFrame(updatePlayhead)
      }

      animationRef.current = requestAnimationFrame(updatePlayhead)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, duration, isLooping, bpm, tracks])

  // Update the handleFileUpload function to accept a trackId parameter
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, trackId?: string) => {
    if (!event.target.files || !event.target.files.length || !audioContext.current) return

    const file = event.target.files[0]
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer)

    // If trackId is provided, update that track instead of creating a new one
    if (trackId) {
      setTracks((prev) =>
        prev.map((track) => (track.id === trackId ? { ...track, name: file.name.split(".")[0], audioBuffer } : track)),
      )
    } else {
      // Create a new track if no trackId is provided
      const newTrack: Track = {
        id: crypto.randomUUID(),
        name: file.name.split(".")[0],
        audioBuffer,
        color: COLORS[tracks.length % COLORS.length],
        muted: false,
        solo: false,
        volume: 0.8,
      }

      setTracks((prev) => [...prev, newTrack])
    }
  }

  const startPlayback = () => {
    if (!audioContext.current || tracks.length === 0) return

    // Resume audio context if suspended
    if (audioContext.current.state === "suspended") {
      audioContext.current.resume()
    }

    // Stop any existing playback
    stopPlayback(false)

    // Create new source nodes for each track
    tracks.forEach((track) => {
      if (!track.audioBuffer || !audioContext.current) return

      // Skip track if its position is greater than the current time
      const trackPosition = track.position || 0;
      if (trackPosition > pausedAt.current) {
        return; // Track not yet reached in the timeline
      }

      const source = audioContext.current.createBufferSource()
      source.buffer = track.audioBuffer
      // Remove playback rate adjustment
      source.playbackRate.value = 1.0;

      const gainNode = audioContext.current.createGain()
      gainNode.gain.value = track.muted ? 0 : track.volume

      source.connect(gainNode)
      gainNode.connect(audioContext.current.destination)

      sourceNodes.current.set(track.id, source)
      gainNodes.current.set(track.id, gainNode)

      // Calculate offset within the audio file
      const offsetInTrack = Math.max(0, pausedAt.current - trackPosition);
      source.start(0, offsetInTrack);
    })

    startTime.current = audioContext.current.currentTime
    setIsPlaying(true)
  }

  const stopPlayback = (resetPosition = true) => {
    // Stop all source nodes
    sourceNodes.current.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        // Source might already be stopped
      }
    })

    sourceNodes.current.clear()
    gainNodes.current.clear()

    if (resetPosition) {
      pausedAt.current = 0
      setCurrentTime(0)
    } else {
      pausedAt.current = currentTime
    }

    setIsPlaying(false)
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback(false)
    } else {
      startPlayback()
    }
  }

  const handleStop = () => {
    stopPlayback(true)
  }

  const handleAddTrack = () => {
    const newTrack: Track = {
      id: crypto.randomUUID(),
      name: `Track ${tracks.length + 1}`,
      audioBuffer: null,
      color: COLORS[tracks.length % COLORS.length],
      muted: false,
      solo: false,
      volume: 0.8,
    }

    setTracks((prev) => [...prev, newTrack])
  }

  const handleRemoveTrack = (id: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== id))
  }

  const handleTrackUpdate = (id: string, updates: Partial<Track>) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...updates } : track)))

    // Update gain node if volume or mute changed
    if (isPlaying && (updates.volume !== undefined || updates.muted !== undefined)) {
      const gainNode = gainNodes.current.get(id)
      const track = tracks.find((t) => t.id === id)

      if (gainNode && track) {
        const newVolume =
          updates.muted !== undefined
            ? updates.muted
              ? 0
              : track.volume
            : updates.volume !== undefined
              ? updates.volume
              : track.volume

        gainNode.gain.value = updates.muted || (track.muted && updates.muted === undefined) ? 0 : newVolume
      }
    }
  }

  const handleSeek = (value: number[]) => {
    const newTime = value[0]
    pausedAt.current = newTime
    setCurrentTime(newTime)

    if (isPlaying) {
      stopPlayback(false)
      startPlayback()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Add this helper function to render a basic waveform
  const renderWaveform = (audioBuffer: AudioBuffer, color: string) => {
    if (!audioBuffer) return null;
    
    // Get the first channel data (mono or left channel)
    const data = audioBuffer.getChannelData(0);
    
    // We'll sample the data to create a simplified waveform
    const samples = 100; // Number of samples to display
    const blockSize = Math.floor(data.length / samples);
    const waveformData = [];
    
    // Calculate peak values for each block
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let peak = 0;
      
      // Find the peak in this block
      for (let j = 0; j < blockSize; j++) {
        const value = Math.abs(data[start + j] || 0);
        if (value > peak) {
          peak = value;
        }
      }
      
      waveformData.push(peak);
    }
    
    // Return the waveform SVG
    return (
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${samples} 100`}>
        {waveformData.map((peak, i) => (
          <rect
            key={i}
            x={i}
            y={50 - peak * 50}
            width={1}
            height={peak * 100}
            fill="white"
            opacity={0.8}
          />
        ))}
      </svg>
    );
  };

  return (
    <div className="flex flex-col w-full h-full bg-background border rounded-lg shadow-lg overflow-hidden">
      {/* Transport Controls */}
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePlayPause}
          disabled={tracks.length === 0 || tracks.every((t) => !t.audioBuffer)}
        >
          <Play className={cn("h-4 w-4", isPlaying && "text-green-500")} />
        </Button>
        <Button variant="outline" size="icon" onClick={handleStop} disabled={!isPlaying}>
          <Square className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center gap-2 mx-4">
          <span className="text-sm font-mono">{formatTime(currentTime)}</span>
          <Slider value={[currentTime]} max={duration} step={0.01} onValueChange={handleSeek} className="flex-1" />
          <span className="text-sm font-mono">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Zoom:</span>
          <Slider
            value={[zoom]}
            min={10}
            max={100}
            step={1}
            onValueChange={(value) => setZoom(value[0])}
            className="w-24"
          />
        </div>
      </div>

      {/* BPM and Loop Controls */}
      <div className="flex items-center gap-4 p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">BPM:</span>
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2" 
              onClick={() => setBpm(Math.max(40, bpm - 1))}
            >
              -
            </Button>
            <input 
              type="number" 
              value={bpm} 
              onChange={(e) => setBpm(Number(e.target.value))} 
              className="w-14 h-7 text-center border-y bg-transparent" 
              min="40" 
              max="300"
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2" 
              onClick={() => setBpm(Math.min(300, bpm + 1))}
            >
              +
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Loop:</span>
          <Button 
            variant={isLooping ? "default" : "outline"} 
            size="sm" 
            className="h-7" 
            onClick={() => setIsLooping(!isLooping)}
          >
            {isLooping ? "On" : "Off"}
          </Button>
        </div>
      </div>

      {/* Tracks Container */}
      <div className="flex flex-col flex-1 overflow-auto relative">
        {/* Timeline */}
        <div className="flex h-8 border-b bg-muted/20">
          {/* Fixed track control width area - should not have any grid lines */}
          <div className="w-48 h-full border-r bg-muted/30 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">BARS</span>
          </div>
          
          {/* Timeline with grid - only in the content area */}
          <div className="relative flex-1 overflow-hidden">
            {/* Timeline playhead indicator */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
              style={{ 
                left: `${currentTime * zoom}px`,
                height: '100%',
              }} 
            />

            <div
              className="absolute top-0 bottom-0 flex"
              style={{
                width: `${Math.max(duration * zoom, 100)}px`,
                minWidth: "100%",
              }}
            >
              {/* Render grid based on BPM - simplified to only show bar numbers */}
              {Array.from({ length: Math.floor(duration * (bpm / 60) / 4) + 2 }).map((_, i) => {
                // Calculate actual seconds position for each bar (4 beats)
                const barTimeInSeconds = (i * 4 * 60) / bpm;
                
                // Check if this bar is the current bar
                const currentBeat = Math.floor((currentTime * bpm / 60));
                const currentBar = Math.floor(currentBeat / 4);
                const isCurrentBar = i === currentBar;
                
                return (
                  <div 
                    key={i} 
                    className="relative"
                    style={{ 
                      position: 'absolute', 
                      left: `${barTimeInSeconds * zoom}px`,
                      height: '100%',
                      width: `${(4 * 60 / bpm) * zoom}px`
                    }}
                  >
                    {/* Bar number */}
                    <div className={cn(
                      "absolute top-0 left-0 h-full flex items-center",
                      isCurrentBar && "text-green-500 font-bold"
                    )}>
                      <span className="text-xs pl-1">{i+1}</span>
                    </div>
                    
                    {/* Bar boundary line */}
                    <div 
                      className={cn(
                        "absolute top-0 bottom-0 left-0 border-l",
                        isCurrentBar ? "border-green-500/50 border-l-2" : "border-muted-foreground/50"
                      )}
                    />
                    
                    {/* Beat lines within bar - 4 beats per bar */}
                    {[1, 2, 3].map((beat) => (
                      <div 
                        key={beat}
                        className="absolute top-0 bottom-0 border-l border-muted-foreground/20"
                        style={{
                          left: `${beat * (60 / bpm) * zoom}px`,
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-auto relative">
          <div className="flex">
            {/* Sidebar for track controls and Add Track button - no grid here */}
            <div className="w-48 flex flex-col border-r bg-muted/20">
              {/* Track controls */}
              {tracks.map((track) => (
                <div key={track.id} className="border-b py-2 px-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-3 h-3 rounded-full", track.color)} />
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => handleTrackUpdate(track.id, { name: e.target.value })}
                      className="bg-transparent border rounded px-2 py-1 text-sm flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <button
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded",
                        track.muted ? "bg-destructive text-destructive-foreground" : "bg-secondary"
                      )}
                      onClick={() => handleTrackUpdate(track.id, { muted: !track.muted })}
                    >
                      <span className="sr-only">{track.muted ? "Unmute" : "Mute"}</span>
                      <span className="text-xs">M</span>
                    </button>
                    <button
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded",
                        track.solo ? "bg-amber-500 text-amber-950" : "bg-secondary"
                      )}
                      onClick={() => handleTrackUpdate(track.id, { solo: !track.solo })}
                    >
                      <span className="sr-only">{track.solo ? "Unsolo" : "Solo"}</span>
                      <span className="text-xs">S</span>
                    </button>
                    <div className="flex items-center gap-1 ml-1">
                      <Slider
                        value={[track.volume]}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-16"
                        onValueChange={(value) => handleTrackUpdate(track.id, { volume: value[0] })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      id={`file-${track.id}`}
                      onChange={(e) => handleFileUpload(e, track.id)}
                    />
                    <label
                      htmlFor={`file-${track.id}`}
                      className="text-xs px-2 py-1 bg-secondary rounded cursor-pointer hover:bg-secondary/80"
                    >
                      Upload
                    </label>
                    <button
                      className="text-xs px-2 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                      onClick={() => handleRemoveTrack(track.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Add Track button */}
              <div className="p-2 sticky bottom-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddTrack} 
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Track
                </Button>
              </div>
            </div>
            
            {/* Track content area - with grid overlay */}
            <div className="flex-1 overflow-hidden relative">
              {/* Global playhead positioned in tracks content area */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                style={{ 
                  left: `${currentTime * zoom}px`,
                  height: '100%',
                }} 
              />
            
              {/* Grid lines in track area - to ensure they align with tracks */}
              <div 
                className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-0"
                style={{
                  width: `${Math.max(duration * zoom, 100)}px`,
                  minWidth: "100%",
                }}
              >
                {/* Bar lines */}
                {Array.from({ length: Math.floor(duration * (bpm / 60) / 4) + 2 }).map((_, i) => {
                  const barTimeInSeconds = (i * 4 * 60) / bpm;
                  
                  return (
                    <div key={`bar-${i}`}>
                      {/* Bar line */}
                      <div 
                        className="absolute top-0 bottom-0 border-l border-muted-foreground/30"
                        style={{ 
                          left: `${barTimeInSeconds * zoom}px`,
                          height: '100%',
                        }}
                      />
                      
                      {/* Beat lines within bar */}
                      {[1, 2, 3].map((beat) => (
                        <div 
                          key={`beat-${i}-${beat}`}
                          className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
                          style={{
                            left: `${(barTimeInSeconds + beat * (60 / bpm)) * zoom}px`,
                            height: '100%',
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
              
              {/* Actual audio content only */}
              <div
                className="relative"
                style={{
                  width: `${Math.max(duration * zoom, 100)}px`,
                  minWidth: "100%",
                }}
              >
                {tracks.map((track) => (
                  <div 
                    key={track.id}
                    className="relative h-24 border-b"
                  >
                    {track.audioBuffer && (
                      <div 
                        className={cn(
                          "absolute top-4 bottom-4 rounded",
                          track.color,
                          (track.muted && !track.solo) && "opacity-50"
                        )}
                        style={{
                          left: `${(track.position || 0) * zoom}px`,
                          width: `${track.audioBuffer.duration * zoom}px`,
                        }}
                      >
                        {/* Display audio file name and duration */}
                        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-white">
                          <span>{track.name}</span>
                          <span>{formatTime(track.audioBuffer.duration)}s</span>
                        </div>
                        
                        {/* Display a basic waveform visualization */}
                        <div className="absolute inset-0 px-1 flex items-center justify-center overflow-hidden">
                          {renderWaveform(track.audioBuffer, track.color)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

