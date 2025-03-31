"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Square, Plus, Loader2, FolderPlus, FileText, RotateCcw, Smartphone, Volume2, VolumeX } from "lucide-react"
import { AudioTrack } from "@/components/audio-track"
import { cn } from "@/lib/utils"

// Add a head component to ensure proper viewport settings
const AudioAppHead = () => {
  useEffect(() => {
    // Ensure proper viewport meta tag exists
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no');
  }, []);

  return null;
};

// Mobile device detection and orientation lock
function useMobileOrientation() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      setIsMobile(
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      );
      
      // Check if iOS - fixed to avoid the MSStream property error
      setIsIOS(
        /iphone|ipad|ipod/i.test(userAgent) && 
        !(window as any).MSStream // Use type assertion instead
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

  return { isMobile, isPortrait, isIOS };
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
  
  // Add audio-related state for iOS
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  
  // Add mobile-specific state
  const { isMobile, isPortrait, isIOS } = useMobileOrientation();
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

  // Modify the useEffect for audio initialization to make it more robust for mobile
  useEffect(() => {
    if (typeof window !== "undefined" && !audioContext.current) {
      try {
        // Create audio context with proper mobile handling
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext.current = new AudioContextClass({ latencyHint: "playback" });
        
        // Log audio context state
        console.log('Audio context created with state:', audioContext.current.state);
        
        // Check if context is suspended (likely on iOS/mobile)
        if (audioContext.current.state === "suspended") {
          setAudioInitialized(false);
          
          // For iOS devices, show audio prompt after a brief delay
          if (isIOS) {
            setTimeout(() => {
              setShowAudioPrompt(true);
            }, 500);
          }
        } else {
          setAudioInitialized(true);
        }
        
        // Add listener for state changes
        audioContext.current.onstatechange = () => {
          console.log('Audio context state changed to:', audioContext.current?.state);
          if (audioContext.current?.state === 'running') {
            setAudioInitialized(true);
            setShowAudioPrompt(false);
          }
        };
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }
    }

    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, [isIOS]);

  // Enhance the initializeAudio function to be more robust for mobile
  const initializeAudio = () => {
    console.log('Attempting to initialize audio...');
    if (!audioContext.current) return;
    
    try {
      // Create and play a silent buffer to unlock audio
      const buffer = audioContext.current.createBuffer(1, 1, 22050);
      const source = audioContext.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.current.destination);
      source.start(0);
      
      // Resume audio context
      audioContext.current.resume().then(() => {
        console.log('Audio context resumed successfully');
        setAudioInitialized(true);
        setShowAudioPrompt(false);
      }).catch(err => {
        console.error('Failed to resume audio context:', err);
      });
    } catch (error) {
      console.error('Error in initializeAudio:', error);
    }
  };

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

  // Improve the startPlayback function to handle mobile audio better
  const startPlayback = () => {
    console.log('Start playback called, audio initialized:', audioInitialized);
    
    if (!audioContext.current || tracks.length === 0) {
      console.log('No audio context or tracks, cannot start playback');
      return;
    }

    // For all devices, ensure audio is initialized
    if (audioContext.current.state === "suspended") {
      console.log('Audio context suspended, attempting to resume...');
      
      initializeAudio(); // Always call initialize first
      
      audioContext.current.resume().then(() => {
        console.log('Audio context resumed, starting playback');
        setAudioInitialized(true);
        setShowAudioPrompt(false);
        // Continue with playback after resuming
        setTimeout(() => {
          startActualPlayback();
        }, 100); // Small delay to ensure context is fully resumed
      }).catch(err => {
        console.error('Failed to resume audio context:', err);
      });
    } else {
      console.log('Audio context already running, starting playback directly');
      startActualPlayback();
    }
  };

  const startActualPlayback = () => {
    if (!audioContext.current || tracks.length === 0) return;
    
    stopPlayback(false);

    tracks.forEach((track) => {
      if (!track.audioBuffer || !audioContext.current) return;

      const trackPosition = track.position || 0;
      if (trackPosition > pausedAt.current) {
        return;
      }

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

  // Modify the handlePlayPause to work better for all mobile devices
  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback(false);
    } else {
      // Always try to initialize audio on play for any mobile device
      if (!audioInitialized || (audioContext.current && audioContext.current.state === "suspended")) {
        console.log('Initializing audio before playing');
        initializeAudio();
        // Allow some time for initialization to complete
        setTimeout(() => {
          startPlayback();
        }, 150);
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

  return (
    <>
      <AudioAppHead />
      <div className="fixed inset-0 bg-zinc-950 text-white font-mono overflow-hidden">
        {/* Audio prompt for iOS devices */}
        {showAudioPrompt && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border-2 border-cyan-500 rounded-lg p-5 max-w-xs w-full shadow-xl animate-pulse">
              <div className="flex justify-center mb-4">
                <Volume2 className="h-14 w-14 text-cyan-400" />
              </div>
              <h3 className="text-xl text-center font-bold text-white mb-3">Enable Audio</h3>
              <p className="text-sm text-zinc-300 text-center mb-5">
                Tap the button below to enable audio playback on your mobile device.
              </p>
              <Button 
                onClick={initializeAudio} 
                className="w-full h-12 bg-cyan-600 hover:bg-cyan-700 text-white text-lg font-medium"
              >
                Enable Audio
              </Button>
            </div>
          </div>
        )}
      
        {/* Portrait mode warning for mobile devices */}
        {isMobile && isPortrait && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-8 text-center">
            <Smartphone className="h-16 w-16 text-cyan-400 mb-4 animate-pulse" />
            <h2 className="text-cyan-300 text-2xl font-bold mb-2">Please Rotate Your Device</h2>
            <p className="text-zinc-300 mb-6">This application works best in landscape orientation.</p>
            <RotateCcw className="h-10 w-10 text-white animate-spin" />
          </div>
        )}

        {/* Project Selector */}
        <ProjectSelector
          isVisible={showProjectSelector}
          onNewProject={handleNewProject}
          onLoadProject={handleLoadProject}
          onClose={() => setShowProjectSelector(false)}
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-cyan-500 animate-spin" />
              <p className="text-cyan-300 font-medium">Loading project...</p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col w-full h-full max-h-full bg-black overflow-hidden">
          {/* Header with title and neon effect - simplified for mobile */}
          <div className={cn(
            "bg-black py-2 px-3 border-b border-cyan-500/30 flex justify-between items-center",
            isMobile && "py-1 px-1"
          )}>
            <div className="flex items-center">
              {isMobile ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={toggleSidebar}
                    className="mr-1 h-8 w-8 text-cyan-400"
                  >
                    {sidebarCollapsed ? "≡" : "×"}
                  </Button>
                  <h1 className="text-base font-bold text-white tracking-tight flex items-center truncate">
                    <span className="text-cyan-400 mr-1 text-lg">⬤</span>
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">MUSIC</span>
                  </h1>
                </>
              ) : (
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
                  <span className="text-cyan-400 mr-2 text-2xl">⬤</span>
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">MUSIC WORKSTATION</span>
                </h1>
              )}
              {currentProject && !isMobile && (
                <span className="ml-4 px-3 py-1 bg-zinc-800 rounded-md text-sm text-cyan-200">{currentProject}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!audioInitialized && isIOS && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={initializeAudio}
                  className="text-amber-400 h-8 w-8"
                >
                  <VolumeX className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={toggleProjectSelector}
                className={cn(
                  "bg-zinc-800 text-cyan-300 border-cyan-700/50 hover:bg-zinc-700",
                  isMobile && "h-7 text-xs px-2"
                )}
              >
                <FolderPlus className={cn("mr-1", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                {isMobile ? "Proj" : "Projects"}
              </Button>
              <div className={cn("flex items-center gap-1", isMobile && "scale-90")}>
                <span className="text-xs text-zinc-400">BPM</span>
                <input
                  type="number"
                  min="40"
                  max="240"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 168)}
                  className={cn(
                    "w-16 px-2 rounded-md bg-zinc-900 text-cyan-200 border border-zinc-700 text-center",
                    isMobile ? "h-6 w-12 text-xs" : "h-8"
                  )}
                />
              </div>
            </div>
          </div>
          
          {/* Transport Controls - simplified for mobile */}
          <div className={cn(
            "flex items-center gap-3 p-3 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-sm",
            isMobile && "p-1 gap-1 px-2"
          )}>
            {/* Centered container for play/stop buttons on mobile */}
            <div className={cn(
              "flex gap-2",
              isMobile && "flex-1 justify-center"
            )}>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  // Always try to initialize audio on any button press on mobile
                  if (isMobile && !audioInitialized) {
                    initializeAudio();
                    setTimeout(() => {
                      handlePlayPause();
                    }, 100);
                  } else {
                    handlePlayPause();
                  }
                }}
                disabled={tracks.length === 0 || tracks.every((t) => !t.audioBuffer) || isLoading}
                className={cn(
                  "bg-zinc-900 border-cyan-500/50 hover:bg-zinc-800 shadow-md",
                  isPlaying && "shadow-cyan-500/20 border-cyan-400",
                  isMobile ? "h-8 w-8" : "h-10 w-10"
                )}
              >
                <Play className={cn(
                  isPlaying ? "text-cyan-400" : "text-zinc-300",
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )} />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleStop} 
                disabled={!isPlaying || isLoading}
                className={cn(
                  "bg-zinc-900 border-zinc-700/80 hover:bg-zinc-800 shadow-md",
                  isMobile ? "h-8 w-8" : "h-10 w-10"
                )}
              >
                <Square className={cn(
                  "text-zinc-300",
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )} />
              </Button>
            </div>
            
            {/* Move time display to sides on mobile */}
            <div className={cn(
              "flex-1 flex items-center gap-1 mx-1",
              isMobile && "hidden"
            )}>
              <span className={cn(
                "font-mono text-cyan-300 min-w-[40px] text-right",
                isMobile ? "text-xs min-w-[24px]" : "text-sm"
              )}>{formatTime(currentTime)}</span>
              <div className="relative flex-1 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 opacity-0 group-hover:opacity-100 group-active:opacity-100 rounded-full blur-sm transition-opacity"></div>
                <div className={cn(
                  "relative z-10 flex items-center",
                  isMobile ? "h-3" : "h-5"
                )}>
                  <div className="absolute inset-y-0 left-0 w-full h-1 bg-zinc-800/90 rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  <div 
                    className={cn(
                      "absolute rounded-full bg-white border border-cyan-500 shadow-md shadow-cyan-500/50 hover:scale-125 transition-transform cursor-pointer -translate-y-[1px]",
                      isMobile ? "w-2.5 h-2.5" : "w-3 h-3"
                    )}
                    style={{ left: `calc(${(currentTime / duration) * 100}% - ${isMobile ? 5 : 6}px)` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => handleSeek([parseFloat(e.target.value)])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ touchAction: "none" }}
                  />
                </div>
              </div>
              <span className={cn(
                "font-mono text-cyan-300 min-w-[40px]",
                isMobile ? "text-xs min-w-[24px]" : "text-sm"
              )}>{formatTime(duration)}</span>
            </div>
            
            {/* Mobile-specific transport row that appears below the play buttons */}
            {isMobile && (
              <div className="w-full flex items-center gap-2 mt-1">
                <span className="font-mono text-cyan-300 text-xs min-w-[24px] text-right">
                  {formatTime(currentTime)}
                </span>
                
                <div className="relative flex-1 group">
                  <div className="relative h-3 flex items-center">
                    <div className="absolute inset-y-0 left-0 w-full h-1 bg-zinc-800/90 rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                    </div>
                    <div 
                      className="absolute w-2.5 h-2.5 rounded-full bg-white border border-cyan-500 shadow-md shadow-cyan-500/50 hover:scale-125 transition-transform cursor-pointer -translate-y-[1px]"
                      style={{ left: `calc(${(currentTime / duration) * 100}% - 5px)` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.01"
                      value={currentTime}
                      onChange={(e) => handleSeek([parseFloat(e.target.value)])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                </div>
                
                <span className="font-mono text-cyan-300 text-xs min-w-[24px]">
                  {formatTime(duration)}
                </span>
              </div>
            )}
            
            {!isMobile && (
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
            )}
          </div>

          {/* Condensed BPM and Loop Controls for mobile */}
          {isMobile ? (
            <div className="flex items-center justify-between p-1 border-b border-zinc-800/70 bg-zinc-950 shadow-md">
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 bg-zinc-900/70 rounded-md px-1.5 py-0.5 border border-zinc-800/70 shadow-inner">
                  <span className="text-[10px] font-medium text-cyan-300">Loop:</span>
                  <Button 
                    variant={isLooping ? "default" : "outline"} 
                    size="sm" 
                    className={cn(
                      "h-5 min-w-[30px] px-1 text-[10px]",
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
              <div className="flex items-center gap-1 px-1.5">
                <span className="text-[10px] text-cyan-300">Zoom:</span>
                <Slider
                  value={[zoom]}
                  min={10}
                  max={100}
                  step={1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="w-20"
                />
              </div>
            </div>
          ) : (
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
          )}

          {/* Tracks Container - Main area with full height */}
          <div className="flex flex-col flex-1 overflow-hidden relative bg-black">
            {/* Timeline - simplified for mobile */}
            <div className={cn(
              "flex border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10",
              isMobile ? "h-5" : "h-9"
            )}>
              <div className={cn(
                "border-r border-zinc-800/70 flex items-center justify-center bg-zinc-900/80",
                isMobile ? (sidebarCollapsed ? "w-6" : "w-32") : "w-52"
              )}>
                {!isMobile && <span className="text-xs font-medium text-cyan-400/80">BARS</span>}
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
                          <span className={cn(
                            "pl-1",
                            isMobile ? "text-[8px]" : "text-xs"
                          )}>{i+1}</span>
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
                {/* Track controls sidebar - conditionally show based on mobile state */}
                <div 
                  ref={sidebarRef}
                  className={cn(
                    "flex flex-col border-r border-zinc-800/70 bg-zinc-900/50 flex-shrink-0 overflow-y-auto transition-all duration-200",
                    isMobile 
                      ? (sidebarCollapsed ? "w-6" : "w-32") 
                      : "w-52"
                  )}
                >
                  {tracks.map((track) => (
                    <div 
                      key={track.id} 
                      className={cn(
                        "border-b border-zinc-800/70 flex flex-col justify-between",
                        isMobile ? (sidebarCollapsed ? "h-16 p-0.5" : "h-20 p-1") : "h-32 p-2"
                      )}
                    >
                      {sidebarCollapsed && isMobile ? (
                        // Collapsed mobile view - just show colored indicator and minimal controls
                        <div className="flex flex-col h-full items-center justify-between py-0.5">
                          <div className={cn("w-3 h-3 rounded-full shadow-[0_0_5px]", track.color, track.color.replace('bg-', 'shadow-'))} />
                          <div className="flex flex-col gap-0.5 items-center">
                            <button
                              className={cn(
                                "w-5 h-5 flex items-center justify-center rounded-sm shadow-md transition-colors",
                                track.muted 
                                  ? "bg-red-600/90 text-white shadow-red-500/20" 
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                              )}
                              onClick={() => handleTrackUpdate(track.id, { muted: !track.muted })}
                            >
                              <span className="text-[8px] font-medium">M</span>
                            </button>
                            <button
                              className={cn(
                                "w-5 h-5 flex items-center justify-center rounded-sm shadow-md transition-colors",
                                track.solo 
                                  ? "bg-amber-500/90 text-amber-950 shadow-amber-400/20" 
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                              )}
                              onClick={() => handleTrackUpdate(track.id, { solo: !track.solo })}
                            >
                              <span className="text-[8px] font-medium">S</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Full sidebar view - desktop or expanded mobile
                        <>
                          <div className="flex items-center gap-1 mb-1">
                            <div className={cn("w-3 h-3 rounded-full shadow-[0_0_5px]", track.color, track.color.replace('bg-', 'shadow-'))} />
                            <input
                              type="text"
                              value={track.name}
                              onChange={(e) => handleTrackUpdate(track.id, { name: e.target.value })}
                              className={cn(
                                "bg-zinc-900 border border-zinc-800 rounded-md px-2 py-0.5 w-full text-zinc-200 focus:border-cyan-500/70 focus:outline-none focus:ring-1 focus:ring-cyan-500/30",
                                isMobile ? "text-[10px]" : "text-sm"
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <button
                              className={cn(
                                "flex items-center justify-center rounded-md shadow-md transition-colors",
                                track.muted 
                                  ? "bg-red-600/90 text-white shadow-red-500/20" 
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                                isMobile ? "w-5 h-5" : "w-7 h-7"
                              )}
                              onClick={() => handleTrackUpdate(track.id, { muted: !track.muted })}
                            >
                              <span className={cn(
                                "font-medium",
                                isMobile ? "text-[8px]" : "text-xs"
                              )}>M</span>
                            </button>
                            <button
                              className={cn(
                                "flex items-center justify-center rounded-md shadow-md transition-colors",
                                track.solo 
                                  ? "bg-amber-500/90 text-amber-950 shadow-amber-400/20" 
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                                isMobile ? "w-5 h-5" : "w-7 h-7"
                              )}
                              onClick={() => handleTrackUpdate(track.id, { solo: !track.solo })}
                            >
                              <span className={cn(
                                "font-medium",
                                isMobile ? "text-[8px]" : "text-xs"
                              )}>S</span>
                            </button>
                            <div className="flex flex-col gap-0.5 w-full pr-1">
                              <div className="flex items-center justify-between text-[8px] text-zinc-400">
                                <span>Vol</span>
                                <span>{Math.round(track.volume * 100)}%</span>
                              </div>
                              <VolumeSlider 
                                value={track.volume} 
                                onChange={(value) => handleTrackUpdate(track.id, { volume: value })}
                                trackColor={track.muted ? "bg-zinc-600/50" : track.color.replace('bg-', 'bg-') + "/80"}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col w-full mb-1">
                            <LoudnessMeter 
                              level={rmsLevels[track.id] || 0} 
                              className="h-1 w-full"
                            />
                          </div>
                          {!isMobile && (
                            <div className="flex items-center gap-1.5 justify-between">
                              <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                id={`file-${track.id}`}
                                onChange={(e) => handleFileUpload(e, track.id)}
                              />
                              <label
                                htmlFor={`file-${track.id}`}
                                className="text-xs px-3 py-1.5 bg-zinc-800 text-cyan-300 rounded-md cursor-pointer hover:bg-zinc-700 shadow-sm transition-colors flex-grow text-center"
                              >
                                Upload
                              </label>
                              <button
                                className="text-xs px-3 py-1.5 bg-red-600/80 text-white rounded-md hover:bg-red-700 shadow-sm transition-colors flex-grow text-center"
                                onClick={() => handleRemoveTrack(track.id)}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          {isMobile && (
                            <button
                              className="text-[8px] px-1.5 py-0.5 bg-red-600/80 text-white rounded-sm hover:bg-red-700 shadow-sm transition-colors text-center"
                              onClick={() => handleRemoveTrack(track.id)}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  
                  <div className={cn(
                    "mt-auto bg-zinc-900/80 border-t border-zinc-800/70",
                    isMobile ? (sidebarCollapsed ? "p-0.5" : "p-1") : "p-2"
                  )}>
                    {!sidebarCollapsed && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleAddTrack} 
                        className={cn(
                          "w-full bg-zinc-800 border-cyan-500/50 text-cyan-300 hover:bg-zinc-700 hover:text-cyan-200 shadow-md",
                          isMobile && "text-[10px] py-0.5 h-6"
                        )}
                      >
                        <Plus className={cn("mr-1", isMobile ? "h-2.5 w-2.5" : "h-4 w-4")} />
                        {isMobile ? "Add" : "Add Track"}
                      </Button>
                    )}
                    {sidebarCollapsed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddTrack}
                        className="w-full h-5 p-0 bg-zinc-800 border-cyan-500/50 text-cyan-300"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Track content area */}
                <div 
                  ref={trackContentRef} 
                  className="flex-1 overflow-auto relative"
                  onScroll={handleTrackScroll}
                >
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
                        className={cn(
                          "relative border-b border-zinc-900/70",
                          isMobile ? "h-16" : "h-32"
                        )}
                      >
                        {track.audioBuffer && (
                          <div 
                            className={cn(
                              "absolute top-1 bottom-1 rounded-md transition-all shadow-md",
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
                            <div className="absolute inset-x-0 top-0 h-2 bg-black/30 hover:bg-black/40 rounded-t cursor-move flex items-center justify-center">
                              <div className="w-8 h-0.5 bg-white/70 rounded-full"></div>
                            </div>
                            
                            <div className="absolute -left-0.5 top-0 bottom-0 w-0.5 bg-white/70"></div>
                            <div className="absolute -right-0.5 top-0 bottom-0 w-0.5 bg-white/70"></div>
                            
                            <div className={cn(
                              "absolute inset-0 flex flex-col justify-between select-none",
                              isMobile ? "px-1.5 py-0.5" : "px-3 py-1.5" 
                            )}>
                              <div className="w-full overflow-hidden">
                                <div className="flex items-center justify-between">
                                  <span className={cn(
                                    "font-medium truncate max-w-[85%]",
                                    isMobile ? "text-[8px]" : "text-xs"
                                  )}>{track.name}</span>
                                  <span className={cn(
                                    "bg-black/50 rounded",
                                    isMobile ? "text-[6px] px-1 py-0" : "text-[9px] px-1.5 py-0.5"
                                  )}>{formatTime(track.audioBuffer.duration)}</span>
                                </div>
                              </div>
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
      </div>
    </>
  )
}

