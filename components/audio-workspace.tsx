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
  const [dragInfo, setDragInfo] = useState<{ 
    trackId: string; 
    startX: number; 
    startPosition: number;
    currentPosition?: number;
  } | null>(null)

  const audioContext = useRef<AudioContext | null>(null)
  const sourceNodes = useRef<Map<string, AudioBufferSourceNode>>(new Map())
  const gainNodes = useRef<Map<string, GainNode>>(new Map())
  const animationRef = useRef<number | null>(null)
  const startTime = useRef<number>(0)
  const pausedAt = useRef<number>(0)
  const trackContainerRef = useRef<HTMLDivElement>(null)
  const loopScheduledRef = useRef<boolean>(false)

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

  useEffect(() => {
    if (tracks.length === 0) {
      setDuration(60)
      return
    }

    const maxDuration = Math.max(
      ...tracks
        .filter((track) => track.audioBuffer)
        .map((track) => (track.position || 0) + (track.audioBuffer?.duration || 0)),
      60
    )

    setDuration(maxDuration)
  }, [tracks])

  useEffect(() => {
    if (isPlaying) {
      const updatePlayhead = () => {
        if (audioContext.current) {
          const elapsed = audioContext.current.currentTime - startTime.current
          const newCurrentTime = pausedAt.current + elapsed;
          setCurrentTime(newCurrentTime)

          // Calculate the effective loop end based on content
          const loopEndPoint = getLoopEndPoint();
          
          // Define a small buffer time before loop end to prepare for smooth transition
          const loopPrepBuffer = 0.1; // 100ms preparation time
          
          // Check if we need to schedule tracks that should start between now and the next update
          tracks.forEach((track) => {
            const trackPosition = track.position || 0;
            
            if (track.audioBuffer && 
                trackPosition > pausedAt.current && 
                trackPosition <= newCurrentTime && 
                !sourceNodes.current.has(track.id)) {
              
              const source = audioContext.current!.createBufferSource();
              source.buffer = track.audioBuffer;
              source.playbackRate.value = 1.0;
              
              const gainNode = audioContext.current!.createGain();
              gainNode.gain.value = track.muted ? 0 : track.volume;
              
              source.connect(gainNode);
              gainNode.connect(audioContext.current!.destination);
              
              source.start(0, 0);
              
              sourceNodes.current.set(track.id, source);
              gainNodes.current.set(track.id, gainNode);
            }
          });

          // If we're approaching the loop end point, prepare for smooth looping
          if (isLooping && newCurrentTime >= loopEndPoint - loopPrepBuffer && newCurrentTime < loopEndPoint) {
            // Only schedule the loop once when we enter the buffer zone
            if (!loopScheduledRef.current) {
              loopScheduledRef.current = true;
              
              // Schedule the new playback precisely at the loop point
              const timeToLoopPoint = loopEndPoint - newCurrentTime;
              const scheduleTime = audioContext.current.currentTime + timeToLoopPoint;
              
              // Schedule all sources for the loop start
              scheduleLoopStart(scheduleTime);
            }
          }

          // If we've passed the loop end point, reset UI state
          if (newCurrentTime >= loopEndPoint) {
            if (isLooping) {
              // Reset visual playhead without disrupting audio
              pausedAt.current = 0;
              setCurrentTime(0);
              startTime.current = audioContext.current.currentTime - (newCurrentTime - loopEndPoint);
            } else {
              stopPlayback(true);
              return;
            }
          }
        }
        animationRef.current = requestAnimationFrame(updatePlayhead)
      }

      loopScheduledRef.current = false;
      animationRef.current = requestAnimationFrame(updatePlayhead)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      loopScheduledRef.current = false;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      loopScheduledRef.current = false;
    }
  }, [isPlaying, duration, isLooping, bpm, tracks])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, trackId?: string) => {
    if (!event.target.files || !event.target.files.length || !audioContext.current) return

    const file = event.target.files[0]
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer)

    if (trackId) {
      setTracks((prev) =>
        prev.map((track) => (track.id === trackId ? { ...track, name: file.name.split(".")[0], audioBuffer } : track)),
      )
    } else {
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

    if (audioContext.current.state === "suspended") {
      audioContext.current.resume()
    }

    stopPlayback(false)

    tracks.forEach((track) => {
      if (!track.audioBuffer || !audioContext.current) return

      const trackPosition = track.position || 0;
      if (trackPosition > pausedAt.current) {
        return;
      }

      const source = audioContext.current.createBufferSource()
      source.buffer = track.audioBuffer
      source.playbackRate.value = 1.0;

      const gainNode = audioContext.current.createGain()
      gainNode.gain.value = track.muted ? 0 : track.volume

      source.connect(gainNode)
      gainNode.connect(audioContext.current.destination)

      sourceNodes.current.set(track.id, source)
      gainNodes.current.set(track.id, gainNode)

      const offsetInTrack = Math.max(0, pausedAt.current - trackPosition);
      source.start(0, offsetInTrack);
    })

    startTime.current = audioContext.current.currentTime
    setIsPlaying(true)
  }

  const stopPlayback = (resetPosition = true) => {
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

  const renderWaveform = (audioBuffer: AudioBuffer, color: string) => {
    if (!audioBuffer) return null;
    
    const data = audioBuffer.getChannelData(0);
    
    const samples = 100;
    const blockSize = Math.floor(data.length / samples);
    const waveformData = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let peak = 0;
      
      for (let j = 0; j < blockSize; j++) {
        const value = Math.abs(data[start + j] || 0);
        if (value > peak) {
          peak = value;
        }
      }
      
      waveformData.push(peak);
    }
    
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

  const getBeatDuration = () => {
    return 60 / bpm;
  }
  
  const getSnappedPosition = (position: number) => {
    const beatDuration = getBeatDuration();
    return Math.round(position / beatDuration) * beatDuration;
  }

  const handleDragStart = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.audioBuffer) return;
    
    const containerRect = trackContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    const elementRect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - elementRect.left;
    
    const startX = e.clientX;
    const startPosition = track.position || 0;
    
    setDragInfo({
      trackId,
      startX,
      startPosition,
      currentPosition: startPosition,
    });
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  const handleDragMove = (e: MouseEvent) => {
    if (!dragInfo || !trackContainerRef.current) return;
    
    e.preventDefault();
    
    const containerRect = trackContainerRef.current.getBoundingClientRect();
    
    const deltaX = e.clientX - dragInfo.startX;
    const deltaTime = deltaX / zoom;
    
    const rawPosition = Math.max(0, dragInfo.startPosition + deltaTime);
    
    const snappedPosition = getSnappedPosition(rawPosition);
    
    setDragInfo({
      ...dragInfo,
      currentPosition: snappedPosition
    });
    
    setTracks(prev => prev.map(track => 
      track.id === dragInfo.trackId
        ? { ...track, position: snappedPosition }
        : track
    ));
  };
  
  const handleDragEnd = (e: MouseEvent) => {
    if (!dragInfo) return;
    
    if (trackContainerRef.current) {
      const deltaX = e.clientX - dragInfo.startX;
      const deltaTime = deltaX / zoom;
      
      const rawPosition = Math.max(0, dragInfo.startPosition + deltaTime);
      
      const snappedPosition = getSnappedPosition(rawPosition);
      
      setTracks(prev => prev.map(track => 
        track.id === dragInfo.trackId
          ? { ...track, position: snappedPosition }
          : track
      ));
    }
    
    setDragInfo(null);
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };
  
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [])

  // Add a function to calculate the effective loop end point
  const getLoopEndPoint = () => {
    if (tracks.length === 0) return duration;
    
    // Find the endpoint of the last clip (position + duration)
    const lastEndPoint = Math.max(
      ...tracks
        .filter(track => track.audioBuffer)
        .map(track => (track.position || 0) + track.audioBuffer!.duration),
      0 // Minimum value
    );
    
    // If there are no clips with audio, return the full duration
    return lastEndPoint > 0 ? lastEndPoint : duration;
  };

  // Add a function to schedule sources for loop start
  const scheduleLoopStart = (exactStartTime: number) => {
    if (!audioContext.current) return;
    
    // Stop existing source nodes after loop transition is complete
    const existingSourceIds = Array.from(sourceNodes.current.keys());
    
    // Schedule new sources to start exactly at the loop point
    tracks.forEach((track) => {
      if (!track.audioBuffer || !audioContext.current) return;

      // Only schedule tracks that should play at start position
      const trackPosition = track.position || 0;
      if (trackPosition > 0) return;

      // Create and schedule a new source
      const newSource = audioContext.current.createBufferSource();
      newSource.buffer = track.audioBuffer;
      newSource.playbackRate.value = 1.0;
      
      const gainNode = audioContext.current.createGain();
      gainNode.gain.value = track.muted ? 0 : track.volume;
      
      newSource.connect(gainNode);
      gainNode.connect(audioContext.current.destination);
      
      // Use absolute scheduling for precise timing
      newSource.start(exactStartTime, 0);
      
      // Add a unique loop ID to distinguish the new sources
      const loopSourceId = `loop_${track.id}`;
      sourceNodes.current.set(loopSourceId, newSource);
      gainNodes.current.set(loopSourceId, gainNode);
    });
    
    // Schedule cleanup of old sources shortly after new ones start
    setTimeout(() => {
      existingSourceIds.forEach(id => {
        try {
          const source = sourceNodes.current.get(id);
          if (source) {
            source.stop();
            sourceNodes.current.delete(id);
          }
          
          gainNodes.current.delete(id);
        } catch (e) {
          // Source might already be stopped
        }
      });
    }, 100); // Cleanup 100ms after loop - this creates a brief crossfade
  }

  return (
    <div className="absolute inset-0 flex flex-col w-full h-screen max-h-screen bg-black overflow-hidden">
      {/* Header with title and neon effect */}
      <div className="bg-black py-3 px-4 border-b border-cyan-500/30 flex items-center">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
          <span className="text-cyan-400 mr-2 text-2xl">⬤</span>
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">MUSIC WORKSTATION</span>
        </h1>
      </div>
      
      {/* Transport Controls - futuristic styling improvements */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePlayPause}
            disabled={tracks.length === 0 || tracks.every((t) => !t.audioBuffer)}
            className={cn(
              "bg-zinc-900 border-cyan-500/50 hover:bg-zinc-800 h-10 w-10 shadow-md",
              isPlaying && "shadow-cyan-500/20 border-cyan-400"
            )}
          >
            <Play className={cn("h-5 w-5", isPlaying ? "text-cyan-400" : "text-zinc-300")} />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleStop} 
            disabled={!isPlaying}
            className="bg-zinc-900 border-zinc-700/80 hover:bg-zinc-800 h-10 w-10 shadow-md"
          >
            <Square className="h-5 w-5 text-zinc-300" />
          </Button>
        </div>
        <div className="flex-1 flex items-center gap-3 mx-2">
          <span className="text-sm font-mono text-cyan-300 min-w-[40px] text-right">{formatTime(currentTime)}</span>
          <div className="relative flex-1 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 opacity-0 group-hover:opacity-100 rounded-full blur-sm transition-opacity"></div>
            <Slider 
              value={[currentTime]} 
              max={duration} 
              step={0.01} 
              onValueChange={handleSeek} 
              className="relative z-10" 
            />
          </div>
          <span className="text-sm font-mono text-cyan-300 min-w-[40px]">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/70 px-3 py-2 rounded-md border border-zinc-800/70 shadow-inner">
          <span className="text-sm text-cyan-300">Zoom:</span>
          <Slider
            value={[zoom]}
            min={10}
            max={100}
            step={1}
            onValueChange={(value) => setZoom(value[0])}
            className="w-36"
          />
        </div>
      </div>

      {/* BPM and Loop Controls - futuristic styling */}
      <div className="flex items-center gap-4 p-3 border-b border-zinc-800/70 bg-zinc-950 shadow-md">
        <div className="flex items-center gap-2 bg-zinc-900/70 rounded-md px-3 py-1.5 border border-zinc-800/70 shadow-inner">
          <span className="text-sm font-medium text-cyan-300">BPM:</span>
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-cyan-300 hover:bg-zinc-800 hover:text-cyan-200" 
              onClick={() => setBpm(Math.max(40, bpm - 1))}
            >
              -
            </Button>
            <input 
              type="number" 
              value={bpm} 
              onChange={(e) => setBpm(Number(e.target.value))} 
              className="w-16 h-7 text-center border-y border-zinc-700 bg-zinc-950 text-cyan-200" 
              min="40" 
              max="300"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-cyan-300 hover:bg-zinc-800 hover:text-cyan-200" 
              onClick={() => setBpm(Math.min(300, bpm + 1))}
            >
              +
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/70 rounded-md px-3 py-1.5 border border-zinc-800/70 shadow-inner">
          <span className="text-sm font-medium text-cyan-300">Loop:</span>
          <Button 
            variant={isLooping ? "default" : "outline"} 
            size="sm" 
            className={cn(
              "h-7 min-w-[40px]",
              isLooping 
                ? "bg-cyan-600/80 hover:bg-cyan-700 text-white shadow-md shadow-cyan-500/20 border-none" 
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700"
            )}
            onClick={() => setIsLooping(!isLooping)}
          >
            {isLooping ? "On" : "Off"}
          </Button>
        </div>
      </div>

      {/* Tracks Container - Main area with full height */}
      <div className="flex flex-col flex-1 overflow-auto relative bg-black">
        {/* Timeline */}
        <div className="flex h-9 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="w-48 h-full border-r border-zinc-800/70 flex items-center justify-center bg-zinc-900/80">
            <span className="text-xs font-medium text-cyan-400/80">BARS</span>
          </div>
          
          <div className="relative flex-1 overflow-hidden">
            <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-500 z-10 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,0.5)]"
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
              {Array.from({ length: Math.floor(duration * (bpm / 60) / 4) + 2 }).map((_, i) => {
                const barTimeInSeconds = (i * 4 * 60) / bpm;
                
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
                    <div className={cn(
                      "absolute top-0 left-0 h-full flex items-center",
                      isCurrentBar ? "text-cyan-400 font-bold" : "text-zinc-500"
                    )}>
                      <span className="text-xs pl-1">{i+1}</span>
                    </div>
                    
                    <div 
                      className={cn(
                        "absolute top-0 bottom-0 left-0 border-l",
                        isCurrentBar ? "border-cyan-500/70 border-l-2 shadow-[0_0_8px_rgba(34,211,238,0.3)]" : "border-zinc-700/70"
                      )}
                    />
                    
                    {[1, 2, 3].map((beat) => (
                      <div 
                        key={beat}
                        className="absolute top-0 bottom-0 border-l border-zinc-800/70"
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
        <div className="flex-1 overflow-hidden relative">
          <div className="flex h-full">
            {/* Track controls sidebar - futuristic styling */}
            <div className="w-48 flex flex-col border-r border-zinc-800/70 bg-zinc-900/50 flex-shrink-0">
              {tracks.map((track) => (
                <div key={track.id} className="border-b border-zinc-800/70 py-2 px-2 h-24 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("w-3 h-3 rounded-full shadow-[0_0_5px]", track.color, track.color.replace('bg-', 'shadow-'))} />
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => handleTrackUpdate(track.id, { name: e.target.value })}
                      className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-sm flex-1 text-zinc-200 focus:border-cyan-500/70 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <button
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded-md shadow-md",
                        track.muted 
                          ? "bg-red-600/90 text-white shadow-red-500/20" 
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      )}
                      onClick={() => handleTrackUpdate(track.id, { muted: !track.muted })}
                    >
                      <span className="sr-only">{track.muted ? "Unmute" : "Mute"}</span>
                      <span className="text-xs font-medium">M</span>
                    </button>
                    <button
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded-md shadow-md",
                        track.solo 
                          ? "bg-amber-500/90 text-amber-950 shadow-amber-400/20" 
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      )}
                      onClick={() => handleTrackUpdate(track.id, { solo: !track.solo })}
                    >
                      <span className="sr-only">{track.solo ? "Unsolo" : "Solo"}</span>
                      <span className="text-xs font-medium">S</span>
                    </button>
                    <div className="flex items-center gap-1 ml-1">
                      <Slider
                        value={[track.volume]}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-20"
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
                      className="text-xs px-2 py-1 bg-zinc-800 text-cyan-300 rounded-md cursor-pointer hover:bg-zinc-700 shadow-sm"
                    >
                      Upload
                    </label>
                    <button
                      className="text-xs px-2 py-1 bg-red-600/80 text-white rounded-md hover:bg-red-700 shadow-sm"
                      onClick={() => handleRemoveTrack(track.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="p-2 mt-auto bg-zinc-900/80 border-t border-zinc-800/70">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddTrack} 
                  className="w-full bg-zinc-800 border-cyan-500/50 text-cyan-300 hover:bg-zinc-700 hover:text-cyan-200 shadow-md"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Track
                </Button>
              </div>
            </div>
            
            {/* Track content area - futuristic styling */}
            <div className="flex-1 overflow-auto relative">
              <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-500 z-20 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                style={{ 
                  left: `${currentTime * zoom}px`,
                  height: '100%',
                }} 
              />
            
              <div 
                className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-0"
                style={{
                  width: `${Math.max(duration * zoom, 100)}px`,
                  minWidth: "100%",
                }}
              >
                {Array.from({ length: Math.floor(duration * (bpm / 60) / 4) + 2 }).map((_, i) => {
                  const barTimeInSeconds = (i * 4 * 60) / bpm;
                  
                  return (
                    <div key={`bar-${i}`}>
                      <div 
                        className="absolute top-0 bottom-0 border-l border-zinc-800/50"
                        style={{ 
                          left: `${barTimeInSeconds * zoom}px`,
                          height: '100%',
                        }}
                      />
                      
                      {[1, 2, 3].map((beat) => (
                        <div 
                          key={`beat-${i}-${beat}`}
                          className="absolute top-0 bottom-0 border-l border-zinc-900/60"
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
              
              <div
                ref={trackContainerRef}
                className="relative"
                style={{
                  width: `${Math.max(duration * zoom, 100)}px`,
                  minWidth: "100%",
                }}
              >
                {tracks.map((track) => (
                  <div 
                    key={track.id}
                    className="relative h-24 border-b border-zinc-900/70"
                  >
                    {track.audioBuffer && (
                      <div 
                        className={cn(
                          "absolute top-2 bottom-2 rounded-md transition-all shadow-md",
                          track.color,
                          `shadow-[0_0_10px] ${track.color.replace('bg-', 'shadow-')}`,
                          (track.muted && !track.solo) && "opacity-40",
                          dragInfo?.trackId === track.id 
                            ? "cursor-grabbing shadow-lg z-10 ring-2 ring-white/50 scale-[1.01]" 
                            : "cursor-grab hover:brightness-110 hover:shadow-lg"
                        )}
                        style={{
                          left: `${(track.position || 0) * zoom}px`,
                          width: `${track.audioBuffer.duration * zoom}px`,
                        }}
                        onMouseDown={(e) => handleDragStart(e, track.id)}
                      >
                        <div className="absolute inset-x-0 top-0 h-3 bg-black/30 hover:bg-black/40 rounded-t cursor-move flex items-center justify-center">
                          <div className="w-10 h-1 bg-white/70 rounded-full"></div>
                        </div>
                        
                        <div className="absolute -left-0.5 top-0 bottom-0 w-0.5 bg-white/70"></div>
                        <div className="absolute -right-0.5 top-0 bottom-0 w-0.5 bg-white/70"></div>
                        
                        <div className="absolute inset-0 flex items-center justify-between px-3 py-2 text-xs text-white select-none">
                          <span className="font-medium truncate">{track.name}</span>
                          <span className="bg-black/40 px-1.5 py-0.5 rounded-md">{formatTime(track.audioBuffer.duration)}s</span>
                        </div>
                        
                        <div className="absolute inset-0 px-1 flex items-center justify-center overflow-hidden pointer-events-none">
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

