"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Square, Plus, Loader2, FolderPlus, FileText, RotateCcw, Smartphone } from "lucide-react"
import { AudioTrack } from "@/components/audio-track"
import { cn } from "@/lib/utils"

// Add Window interface extension at the very top of the file
declare global {
  interface Window {
    audioContextRef: any;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

// Mobile device detection and orientation lock
function useMobileOrientation() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      setIsMobile(
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      );
    };

    // Check orientation
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    checkMobile();
    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  return { isMobile, isPortrait };
}

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

// Add this custom component for volume slider
const VolumeSlider = ({ value, onChange, trackColor }: { value: number, onChange: (value: number) => void, trackColor: string }) => {
  return (
    <div className="relative w-full h-4 group">
      <div className="absolute inset-y-0 left-0 w-full h-1.5 my-auto bg-zinc-700/70 rounded-full"></div>
      <div 
        className={`absolute inset-y-0 left-0 h-1.5 my-auto rounded-full transition-all ${trackColor}`}
        style={{ width: `${value * 100}%` }}
      ></div>
      
      {/* Tick marks */}
      <div className="absolute inset-0 flex justify-between px-0.5">
        <div className="w-0.5 h-1.5 my-auto bg-zinc-600/50 rounded-full"></div>
        <div className="w-0.5 h-1.5 my-auto bg-zinc-600/50 rounded-full"></div>
        <div className="w-0.5 h-1.5 my-auto bg-zinc-600/50 rounded-full"></div>
        <div className="w-0.5 h-1.5 my-auto bg-zinc-600/50 rounded-full"></div>
        <div className="w-0.5 h-1.5 my-auto bg-zinc-600/50 rounded-full"></div>
      </div>
      
      <div 
        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md cursor-pointer transition-transform hover:scale-110 active:scale-95`}
        style={{ left: `calc(${value * 100}% - ${value * 12}px)` }}
      ></div>
      
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
      />
    </div>
  );
};

// Update the LoudnessMeter component to make it more visually appealing
const LoudnessMeter = ({ level, className }: { level: number, className?: string }) => {
  // Clamp the level between 0 and 1
  const clampedLevel = Math.max(0, Math.min(1, level));
  
  // Determine the color based on the level
  let barColor = "bg-gradient-to-r from-emerald-500 to-green-500";
  let glow = "";
  
  if (clampedLevel > 0.8) {
    barColor = "bg-gradient-to-r from-yellow-500 to-red-500";
    glow = "shadow-[0_0_4px_rgba(239,68,68,0.5)]";
  } else if (clampedLevel > 0.6) {
    barColor = "bg-gradient-to-r from-green-400 to-yellow-400";
    glow = "shadow-[0_0_3px_rgba(234,179,8,0.4)]";
  } else if (clampedLevel > 0.3) {
    glow = "shadow-[0_0_2px_rgba(16,185,129,0.3)]";
  }
  
  return (
    <div className={cn("relative w-full h-2 bg-zinc-800/70 rounded-sm overflow-hidden", className)}>
      <div 
        className={`absolute inset-y-0 left-0 ${barColor} ${glow} transition-all duration-100`}
        style={{ width: `${clampedLevel * 100}%` }}
      ></div>
      
      {/* Tick marks */}
      <div className="absolute inset-0 flex justify-between px-0.5 pointer-events-none">
        <div className="w-px h-full bg-zinc-700/20"></div>
        <div className="w-px h-full bg-zinc-700/20"></div>
        <div className="w-px h-full bg-zinc-700/40"></div>
        <div className="w-px h-full bg-zinc-700/20"></div>
        <div className="w-px h-full bg-zinc-700/20"></div>
      </div>
      
      {/* Peak indicators at key levels */}
      <div className="absolute inset-0 flex justify-between pointer-events-none">
        <div className="h-full w-px"></div>
        <div className="h-full w-px"></div>
        <div className="h-full w-0.5 bg-yellow-500/30"></div>
        <div className="h-full w-px"></div>
        <div className="h-full w-0.5 bg-red-500/30"></div>
      </div>
    </div>
  );
};

// Project management component
const ProjectSelector = ({ 
  onNewProject, 
  onLoadProject, 
  isVisible, 
  onClose 
}: { 
  onNewProject: () => void, 
  onLoadProject: (project: string) => void, 
  isVisible: boolean,
  onClose: () => void
}) => {
  if (!isVisible) return null;
  
  return (
    <div className="absolute inset-0 bg-zinc-950/90 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[500px] max-w-full shadow-xl">
        <div className="border-b border-zinc-800 p-4">
          <h2 className="text-lg font-medium text-cyan-300">Project Management</h2>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-sm uppercase tracking-wider text-zinc-400 mb-3 border-b border-zinc-800 pb-2">New Project</h3>
            <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer group"
              onClick={onNewProject}
            >
              <div className="bg-cyan-900/50 p-3 rounded-full group-hover:bg-cyan-900/80 transition-colors">
                <FolderPlus className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h4 className="font-medium text-white">Empty Project</h4>
                <p className="text-sm text-zinc-400">Start with a clean workspace</p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm uppercase tracking-wider text-zinc-400 mb-3 border-b border-zinc-800 pb-2">Load Project</h3>
            <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer group"
              onClick={() => onLoadProject("Drake Type Beat")}
            >
              <div className="bg-purple-900/50 p-3 rounded-full group-hover:bg-purple-900/80 transition-colors">
                <FileText className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h4 className="font-medium text-white">Drake Type Beat</h4>
                <p className="text-sm text-zinc-400">Load the Separate sample project</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-zinc-800 p-4 flex justify-end">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// Update the unlockAudioOnIOS function with proper typing
function unlockAudioOnIOS() {
  // Create and play a silent audio element with a visible backup button
  const button = document.createElement('button');
  button.id = 'enable-audio-btn';
  button.innerHTML = '🔊 Enable Audio';
  button.style.cssText = 'position:fixed; z-index:1000; bottom:10px; left:50%; transform:translateX(-50%); background:#0ea5e9; color:white; border:none; border-radius:6px; padding:10px 16px; font-weight:bold; display:none; box-shadow: 0 2px 10px rgba(0,0,0,0.3);';
  document.body.appendChild(button);
  
  // Create a silent sound
  const silentSound = new Audio("data:audio/mp3;base64,//MkxAAHiAICWABElBeKPL/RANb2w+yiT1g/gTok//lP/W/l3h8QO/OCdCqCW2Cw//MkxAQHkAIWUAhEmAQXWUOFW2dxPu//9mr60ElY5sseQ+xxesmHKtZr7bsqqX2L//MkxAgHAAJPUAhEmAQXWTq77oqTMJ5tsrrCqXWUTbt7rkqn3///9FSSFlSq//MkxBQHkAYiUAhFBCi6CoWwlCoGnmzE3FBGTBYy4AG3CBJx8fFgJh4eHhwGOgon/9pcOIHCwcLDwsNCg4OD/8QAAASQAAAITEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
  silentSound.setAttribute('playsinline', 'true');
  silentSound.setAttribute('preload', 'auto');
  
  // Button click handler - show button if needed
  button.addEventListener('click', function() {
    // Try to play the silent sound
    silentSound.play().then(() => {
      button.style.display = 'none';
    }).catch(function(error: Error) {
      console.warn("Audio enable failed:", error);
    });
    
    // Also try to resume the context if it exists
    if (window.audioContextRef && window.audioContextRef.current) {
      window.audioContextRef.current.resume().catch(function(error: Error) {
        console.warn("Context resume failed:", error);
      });
    }
  });
  
  // Try to initialize audio on user gesture
  ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(function(event) {
    document.addEventListener(event, function unlockAudio() {
      silentSound.play().catch(function(e: Error) {
        console.warn("Silent audio failed", e);
        button.style.display = 'block';
      });
      
      // Remove all event listeners once played
      ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(function(e) {
        document.removeEventListener(e, unlockAudio);
      });
    }, { once: true });
  });
  
  return { silentSound, button };
}

// Fix viewport issues for mobile
function fixMobileViewport() {
  if (typeof document === 'undefined') return;
  
  // Fix meta viewport
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  
  // Set content with height to fix iOS issues
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, height=device-height');
  
  // Add style to remove bounce and improve sizing
  const style = document.createElement('style');
  style.textContent = `
    html, body {
      height: 100vh !important;
      width: 100vw !important;
      margin: 0;
      padding: 0;
      overflow: hidden;
      position: fixed;
      touch-action: pan-x pan-y;
    }
    
    .DAW-container {
      height: 100vh !important;
      width: 100vw !important;
      overflow: hidden;
    }
  `;
  
  document.head.appendChild(style);
  return () => {
    try { document.head.removeChild(style); } 
    catch(e) { /* Ignore cleanup errors */ }
  };
}

// Add this component definition
function MobileViewportOptimizer() {
  useEffect(() => {
    return fixMobileViewport();
  }, []);
  
  return null;
}

export function AudioWorkspace() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(50)
  const [bpm, setBpm] = useState(168)
  const [isLooping, setIsLooping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showProjectSelector, setShowProjectSelector] = useState(true) // Show project selector on startup
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [dragInfo, setDragInfo] = useState<{ 
    trackId: string; 
    startX: number; 
    startPosition: number;
    currentPosition?: number;
  } | null>(null)
  
  // Add mobile-specific state
  const { isMobile, isPortrait } = useMobileOrientation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const audioContext = useRef<AudioContext | null>(null)
  const sourceNodes = useRef<Map<string, AudioBufferSourceNode>>(new Map())
  const gainNodes = useRef<Map<string, GainNode>>(new Map())
  const animationRef = useRef<number | null>(null)
  const startTime = useRef<number>(0)
  const pausedAt = useRef<number>(0)
  const trackContainerRef = useRef<HTMLDivElement>(null)
  const loopScheduledRef = useRef<boolean>(false)

  const bpmRef = useRef(bpm);
  
  // Add RMS levels state to track loudness for each track
  const [rmsLevels, setRmsLevels] = useState<Record<string, number>>({});
  
  // Add analyzer nodes for RMS calculation
  const analyzerNodes = useRef<Map<string, AnalyserNode>>(new Map());
  
  // Add frame count for smoother RMS updates
  const frameCount = useRef<number>(0);
  
  // Add a separate ref for the RMS animation
  const rmsAnimationRef = useRef<number | null>(null);
  
  // Add a ref for the sidebar to sync scrolling
  const sidebarRef = useRef<HTMLDivElement>(null);
  const trackContentRef = useRef<HTMLDivElement>(null);

  // Add touch handling for mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const touchTrackId = useRef<string | null>(null);
  const touchPosition = useRef<number>(0);
  
  // Add audio button ref
  const audioButtonRef = useRef<HTMLButtonElement | null>(null);

  // Keep track of audio context
  const audioInitialized = useRef(false);

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
      // No longer auto-load project on mount - we'll let the user select a project
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
        // First verify playback is still active
        if (!isPlaying || !audioContext.current) {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          return;
        }
        
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
        
        // Only continue animation if playback is still active
        if (isPlaying) {
          animationRef.current = requestAnimationFrame(updatePlayhead);
        }
      }

      loopScheduledRef.current = false;
      animationRef.current = requestAnimationFrame(updatePlayhead);
      
      // Cleanup function to cancel animation frame when component unmounts or effect dependencies change
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        loopScheduledRef.current = false;
      }
    } else if (animationRef.current) {
      // If not playing but animation is still running, cancel it
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
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
    if (!audioContext.current || tracks.length === 0) return;
    
    // First make sure we can resume the audio context
    if (audioContext.current.state === 'suspended') {
      // On mobile, attempt to resume and show button if it fails
      audioContext.current.resume().then(() => {
        if (audioButtonRef.current) {
          audioButtonRef.current.style.display = 'none';
        }
        startPlaybackInternal();
      }).catch(error => {
        console.warn("Could not resume audio context", error);
        if (audioButtonRef.current) {
          audioButtonRef.current.style.display = 'block';
        }
      });
    } else {
      startPlaybackInternal();
    }
  };

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
    analyzerNodes.current.clear()
    
    // Reset RMS levels when stopping
    if (resetPosition) {
      setRmsLevels({});
      pausedAt.current = 0
      setCurrentTime(0)
    } else {
      pausedAt.current = currentTime
    }

    setIsPlaying(false)
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback(false);
    } else {
      // First make sure we have audio context
      if (!audioContext.current && !audioInitialized.current && typeof window !== "undefined") {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioContext.current = new AudioContext();
          audioInitialized.current = true;
        }
      }

      // Then try to resume if needed
      if (audioContext.current && audioContext.current.state === 'suspended') {
        audioContext.current.resume()
          .then(() => {
            startPlayback();
          })
          .catch(err => {
            console.error("Failed to resume audio context:", err);
            if (isMobile) {
              alert("Please tap the 'Enable Audio' button that appears at the bottom of your screen.");
            }
          });
      } else {
        startPlayback();
      }
    }
  };

  const handleStop = () => {
    // Cancel all animation frames to stop any ongoing animations
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Cancel RMS animation
    if (rmsAnimationRef.current) {
      cancelAnimationFrame(rmsAnimationRef.current);
      rmsAnimationRef.current = null;
    }
    
    // Stop all audio playback and reset positions with true parameter to reset to position 0
    stopPlayback(true);
    
    // Reset the current time display explicitly
    setCurrentTime(0);
    pausedAt.current = 0;
    
    // Reset the RMS levels
    setRmsLevels({});
    
    // Ensure loop scheduled flag is reset
    loopScheduledRef.current = false;
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
    // Stop playback of this track if it's playing
    if (isPlaying) {
      const source = sourceNodes.current.get(id);
      if (source) {
        try {
          source.stop();
          sourceNodes.current.delete(id);
        } catch (e) {
          // Source might already be stopped
        }
      }
      gainNodes.current.delete(id);
    }
    
    setTracks((prev) => prev.filter((track) => track.id !== id));
  }

  const handleTrackUpdate = (id: string, updates: Partial<Track>) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...updates } : track)))

    if (isPlaying) {
      // Handle solo logic
      if (updates.solo !== undefined) {
        const updatedTracks = [...tracks];
        const trackIndex = updatedTracks.findIndex(t => t.id === id);
        if (trackIndex !== -1) {
          updatedTracks[trackIndex] = { ...updatedTracks[trackIndex], solo: updates.solo };
        }
        
        // Fix linter error - only proceed if audioContext exists
        if (!audioContext.current) return;
        
        const hasSoloedTracks = updatedTracks.some(t => t.solo);
        
        updatedTracks.forEach(track => {
          const gainNode = gainNodes.current.get(track.id);
          if (gainNode) {
            // If any track is soloed, only solo tracks play
            if (hasSoloedTracks) {
              gainNode.gain.value = track.solo ? (track.muted ? 0 : track.volume) : 0;
            } else {
              gainNode.gain.value = track.muted ? 0 : track.volume;
            }
          }
        });
      }
      // Handle volume/mute updates
      else if (updates.volume !== undefined || updates.muted !== undefined) {
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

          // Check if any tracks are soloed
          const hasSoloedTracks = tracks.some(t => t.solo);
          
          // If tracks are soloed and this track is not, it should be silent
          if (hasSoloedTracks && !track.solo && updates.solo === undefined) {
            gainNode.gain.value = 0;
          } else {
            gainNode.gain.value = updates.muted || (track.muted && updates.muted === undefined) ? 0 : newVolume;
          }
        }
      }
    }
  }

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    
    // Update UI immediately for responsive feel
    setCurrentTime(newTime);
    
    if (isPlaying) {
      // Save current play state while we update positions
      const wasPlaying = isPlaying;
      
      // Stop existing audio streams without changing play state
      sourceNodes.current.forEach((source) => {
        try {
          source.stop();
        } catch (e) {
          // Source might already be stopped
        }
      });
      
      sourceNodes.current.clear();
      gainNodes.current.clear();
      
      // Update position
      pausedAt.current = newTime;
      
      // Restart playback from new position
      const playAfterSeek = () => {
        if (wasPlaying) {
          tracks.forEach((track) => {
            if (!track.audioBuffer || !audioContext.current) return;
  
            const trackPosition = track.position || 0;
            if (trackPosition > newTime) return;
  
            const source = audioContext.current.createBufferSource();
            source.buffer = track.audioBuffer;
            source.playbackRate.value = 1.0;
  
            const gainNode = audioContext.current.createGain();
            
            // Honor solo state
            const hasSoloedTracks = tracks.some(t => t.solo);
            if (hasSoloedTracks && !track.solo) {
              gainNode.gain.value = 0;
            } else {
              gainNode.gain.value = track.muted ? 0 : track.volume;
            }
  
            source.connect(gainNode);
            gainNode.connect(audioContext.current.destination);
  
            sourceNodes.current.set(track.id, source);
            gainNodes.current.set(track.id, gainNode);
  
            const offsetInTrack = Math.max(0, newTime - trackPosition);
            source.start(0, offsetInTrack);
          });
  
          startTime.current = audioContext.current!.currentTime;
        }
      };
      
      // Small delay to ensure UI is responsive during seeking
      if (audioContext.current) {
        if (audioContext.current.state === "suspended") {
          audioContext.current.resume().then(playAfterSeek);
        } else {
          playAfterSeek();
        }
      }
    } else {
      // Update position when not playing
      pausedAt.current = newTime;
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
    
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
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

  // Add a function to calculate RMS values
  const calculateRMSLevels = () => {
    if (!isPlaying || !audioContext.current) return;
    
    // Only update every few frames for performance
    frameCount.current += 1;
    if (frameCount.current % 3 !== 0) return;
    
    const newLevels: Record<string, number> = {};
    
    tracks.forEach((track) => {
      const analyzer = analyzerNodes.current.get(track.id);
      if (!analyzer) return;
      
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteTimeDomainData(dataArray);
      
      // Calculate RMS
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        // Convert from 0-255 to -1.0 to 1.0
        const amplitude = (dataArray[i] / 128.0) - 1.0;
        sum += amplitude * amplitude;
      }
      
      const rms = Math.sqrt(sum / bufferLength);
      
      // Apply some scaling to make the meter more responsive
      // We'll scale to 0-1 range with some headroom
      const scaledRMS = Math.min(1.0, rms * 2.5);
      
      newLevels[track.id] = scaledRMS;
    });
    
    setRmsLevels(prev => ({...prev, ...newLevels}));
  };

  // Update the RMS calculation useEffect to use and save this ref
  useEffect(() => {
    if (isPlaying) {
      const updateRMS = () => {
        calculateRMSLevels();
        rmsAnimationRef.current = requestAnimationFrame(updateRMS);
      };
      
      rmsAnimationRef.current = requestAnimationFrame(updateRMS);
      
      return () => {
        if (rmsAnimationRef.current) {
          cancelAnimationFrame(rmsAnimationRef.current);
          rmsAnimationRef.current = null;
        }
      };
    } else if (rmsAnimationRef.current) {
      cancelAnimationFrame(rmsAnimationRef.current);
      rmsAnimationRef.current = null;
    }
  }, [isPlaying, tracks]);

  // Function to handle synchronized scrolling
  const handleTrackScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (sidebarRef.current && e.currentTarget === trackContentRef.current) {
      sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Function to handle creating a new project
  const handleNewProject = () => {
    // Clear existing tracks
    stopPlayback(true);
    setTracks([]);
    setCurrentProject(null);
    setShowProjectSelector(false);
  };

  // Function to handle loading a specific project
  const handleLoadProject = (projectName: string) => {
    setCurrentProject(projectName);
    loadProjectByName(projectName);
    setShowProjectSelector(false);
  };

  // Function to load a project by name
  const loadProjectByName = (projectName: string) => {
    if (projectName === "Drake Type Beat") {
      loadDrakeTypeBeats();
    }
  };

  // Function to load the Drake Type Beat project
  const loadDrakeTypeBeats = async () => {
    if (!audioContext.current) return;
    
    setIsLoading(true);
    
    try {
      console.log("Loading Drake Type Beat project...");
      
      // Map track names to file paths
      const tracks = [
        { name: "Kick", file: "Separate (84 BPM) [F#m]_Kick.wav" },
        { name: "Echo Snare", file: "Separate (84 BPM) [F#m]_Echo Snare.wav" },
        { name: "Hi-Hat", file: "Separate (84 BPM) [F#m]_Hi-Hat.wav" },
        { name: "Open Hat", file: "Separate (84 BPM) [F#m]_Open Hat.wav" },
        { name: "Rim", file: "Separate (84 BPM) [F#m]_Rim.wav" },
        { name: "CowBell", file: "Separate (84 BPM) [F#m]_CowBell.wav" },
        { name: "Bassline", file: "Separate (84 BPM) [F#m]_Bassline.wav" },
        { name: "Degraded Piano", file: "Separate (84 BPM) [F#m]_Degraded Piano.wav" },
        { name: "Modern Retrovibe", file: "Separate (84 BPM) [F#m]_Modern Retrovibe.wav" },
        { name: "Piano", file: "Separate (84 BPM) [F#m]_Piano.wav" },
        { name: "Reverse Piano", file: "Separate (84 BPM) [F#m]_Reverse Piano.wav" },
        { name: "Short Brass", file: "Separate (84 BPM) [F#m]_Short Brass.wav" },
        { name: "Vox", file: "Separate (84 BPM) [F#m]_Vox.wav" }
      ];
      
      const newTracks: Track[] = [];
      const loadPromises: Promise<void>[] = [];
      
      for (let i = 0; i < tracks.length; i++) {
        const loadPromise = (async () => {
          try {
            const trackInfo = tracks[i];
            const basePath = "/audio/Seperate Prod Beat It AT/";
            
            // Properly encode the URL
            const filename = trackInfo.file.replace("#", "%23");
            const fullPath = basePath + filename;
            
            console.log(`Attempting to fetch: ${fullPath}`);
            
            const response = await fetch(fullPath);
            
            if (!response.ok) {
              console.error(`Failed to fetch ${fullPath}: ${response.status} ${response.statusText}`);
              return;
            }
            
            const arrayBuffer = await response.arrayBuffer();
            if (!audioContext.current) return;
            
            const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
            
            // Create track with no position offset initially
            newTracks.push({
              id: crypto.randomUUID(),
              name: trackInfo.name,
              audioBuffer,
              color: COLORS[i % COLORS.length],
              muted: false,
              solo: false,
              volume: 0.8,
              position: 0, // All tracks start at position 0
            });
            
            console.log(`Added track: ${trackInfo.name}`);
          } catch (error) {
            console.error(`Error processing track ${tracks[i].name}:`, error);
          }
        })();
        
        loadPromises.push(loadPromise);
      }
      
      // Wait for all files to load before updating state
      await Promise.all(loadPromises);
      
      // Sort tracks to match the specific order
      const sortedTracks = [];
      const trackMap = new Map(newTracks.map(track => [track.name, track]));
      
      for (const { name } of tracks) {
        if (trackMap.has(name)) {
          sortedTracks.push(trackMap.get(name)!);
        }
      }
      
      if (sortedTracks.length > 0) {
        setTracks(sortedTracks);
        console.log(`Successfully loaded ${sortedTracks.length} tracks`);
      } else {
        console.error("No tracks were loaded successfully");
      }
    } catch (error) {
      console.error("Error in loadDrakeTypeBeats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to toggle the project selector
  const toggleProjectSelector = () => {
    setShowProjectSelector(!showProjectSelector);
  };

  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Improve audio init for mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.audioContextRef = audioContext;
    }
    
    // Fix viewport for mobile
    const cleanup = fixMobileViewport();
    
    // Create audio context with mobile support
    if (typeof window !== "undefined" && !audioContext.current) {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioContext.current = new AudioContext();
        
        // Initialize iOS audio - needed for silent mode
        const { button } = unlockAudioOnIOS();
        audioButtonRef.current = button;
        
        // Show button if context is suspended
        if (audioContext.current.state === 'suspended') {
          button.style.display = 'block';
        }
        
        // ... rest of the function
      }
    }
    
    // ... existing code ...
  }, []);

  // Add touch handling for track dragging
  const handleTouchStart = (e: React.TouchEvent, trackId: string) => {
    if (!trackContainerRef.current) return;
    
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.audioBuffer) return;
    
    // Prevent scrolling during drag
    e.preventDefault();
    
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    touchTrackId.current = trackId;
    touchPosition.current = track.position || 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || !touchTrackId.current || !trackContainerRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaTime = deltaX / zoom;
    
    const rawPosition = Math.max(0, touchPosition.current + deltaTime);
    const snappedPosition = getSnappedPosition(rawPosition);
    
    setTracks(prev => prev.map(track => 
      track.id === touchTrackId.current
        ? { ...track, position: snappedPosition }
        : track
    ));
  };
  
  const handleTouchEnd = () => {
    setTouchStartX(null);
    touchTrackId.current = null;
  };

  // Extract actual playback logic for reuse
  const startPlaybackInternal = () => {
    if (!audioContext.current) return;
    
    stopPlayback(false);
    
    tracks.forEach((track) => {
      if (!track.audioBuffer || !audioContext.current) return;
      
      const trackPosition = track.position || 0;
      if (trackPosition > pausedAt.current) return;
      
      const source = audioContext.current.createBufferSource();
      source.buffer = track.audioBuffer;
      source.playbackRate.value = 1.0;
      
      const gainNode = audioContext.current.createGain();
      gainNode.gain.value = track.muted ? 0 : track.volume;
      
      // Create analyzer node for RMS calculation
      const analyzerNode = audioContext.current.createAnalyser();
      analyzerNode.fftSize = 256;
      analyzerNode.smoothingTimeConstant = 0.8;
      
      source.connect(gainNode);
      gainNode.connect(analyzerNode);
      analyzerNode.connect(audioContext.current.destination);
      
      sourceNodes.current.set(track.id, source);
      gainNodes.current.set(track.id, gainNode);
      analyzerNodes.current.set(track.id, analyzerNode);
      
      const offsetInTrack = Math.max(0, pausedAt.current - trackPosition);
      source.start(0, offsetInTrack);
    });
    
    startTime.current = audioContext.current.currentTime;
    setIsPlaying(true);
  };

  return (
    <>
      <MobileViewportOptimizer />
      <div className="w-full h-screen flex flex-col bg-zinc-950 text-white font-mono relative overflow-hidden DAW-container">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          {/* ... existing code ... */}
        </div>
        
        {/* Main content area with flex-1 to take remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Transport controls */}
          <div className={cn(
            "flex items-center border-b border-zinc-800/70 bg-zinc-950/80",
            isMobile ? "p-1 gap-1 h-9" : "p-3 gap-3"
          )}>
            {/* Transport buttons */}
          </div>

          {/* BPM and Loop controls - simplified for mobile */}
          {isMobile ? (
            <div className="flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950 h-7 px-1">
              {/* Compact controls */}
            </div>
          ) : (
            <div className="flex items-center gap-4 p-3 border-b border-zinc-800/70 bg-zinc-950">
              {/* Desktop controls */}
            </div>
          )}

          {/* Tracks area - make sure it takes remaining space */}
          <div className="flex-1 flex flex-col overflow-hidden bg-black">
            {/* Timeline */}
            <div className={cn(
              "flex border-b border-zinc-800/70 bg-zinc-950/80 sticky top-0 z-10",
              isMobile ? "h-5" : "h-8"
            )}>
              {/* Timeline content */}
            </div>

            {/* Tracks - this should fill remaining space */}
            <div className="flex-1 overflow-hidden relative">
              <div className="flex h-full">
                {/* Sidebar */}
                <div 
                  ref={sidebarRef}
                  className={cn(
                    "flex flex-col border-r border-zinc-800/70 bg-zinc-900/50 flex-shrink-0 overflow-y-auto",
                    isMobile 
                      ? (sidebarCollapsed ? "w-6" : "w-28") 
                      : "w-48"
                  )}
                >
                  {/* Track controls */}
                </div>
                
                {/* Main track content area */}
                <div 
                  ref={trackContentRef} 
                  className="flex-1 overflow-auto relative"
                  onScroll={handleTrackScroll}
                >
                  {/* Content area */}
                  {tracks.map((track) => (
                    <div 
                      key={track.id}
                      className={cn(
                        "relative border-b border-zinc-900/70",
                        isMobile ? "h-16" : "h-32"
                      )}
                    >
                      {track.audioBuffer && (
                        <div 
                          className="..."
                          style={{
                            left: `${(track.position || 0) * zoom}px`,
                            width: `${track.audioBuffer.duration * zoom}px`,
                            top: isMobile ? '2px' : '4px',
                            bottom: isMobile ? '2px' : '4px'
                          }}
                          onMouseDown={(e) => handleDragStart(e, track.id)}
                          onTouchStart={(e) => handleTouchStart(e, track.id)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                        >
                          {/* Track content */}
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
    </>
  )
}

