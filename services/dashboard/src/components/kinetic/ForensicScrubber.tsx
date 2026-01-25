// ====================================
// FORENSIC SCRUBBER
// Non-Linear Timeline with Waveform Visualization
// Canvas API with sub-pixel precision
// ====================================

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ZoomIn, 
  ZoomOut
} from 'lucide-react';
import { WaveformPoint, TimelineEvent, KINETIC_COLORS } from '../../types/kinetic';

// ====================================
// CONSTANTS
// ====================================

const WAVEFORM_HEIGHT = 120;

const SEVERITY_COLORS: Record<TimelineEvent['severity'], string> = {
  LOW: KINETIC_COLORS.cold,
  MEDIUM: KINETIC_COLORS.warm,
  HIGH: KINETIC_COLORS.hot,
  CRITICAL: KINETIC_COLORS.critical,
};

// ====================================
// WAVEFORM RENDERER
// ====================================

interface WaveformRendererProps {
  data: WaveformPoint[];
  width: number;
  height: number;
  scrubPosition: number;
  zoomLevel: number;
  onScrub: (position: number) => void;
  onEventClick: (event: TimelineEvent) => void;
}

function WaveformRenderer({
  data,
  width,
  height,
  scrubPosition,
  zoomLevel,
  onScrub,
  onEventClick,
}: WaveformRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [mouseX, setMouseX] = useState(0);
  
  // Calculate visible range based on zoom
  const visibleRange = useMemo(() => {
    const rangeSize = data.length / zoomLevel;
    const center = scrubPosition * data.length;
    const start = Math.max(0, center - rangeSize / 2);
    const end = Math.min(data.length, start + rangeSize);
    return { start: Math.floor(start), end: Math.floor(end) };
  }, [data.length, scrubPosition, zoomLevel]);
  
  // Render waveform to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear
    ctx.fillStyle = KINETIC_COLORS.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = KINETIC_COLORS.glassBorder;
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Visible data slice
    const visibleData = data.slice(visibleRange.start, visibleRange.end);
    if (visibleData.length === 0) return;
    
    const pointWidth = width / visibleData.length;
    const waveformCenter = height / 2;
    const waveformAmplitude = height / 2 - 20;
    
    // Draw sentiment fill (area under curve)
    ctx.beginPath();
    ctx.moveTo(0, waveformCenter);
    
    visibleData.forEach((point, i) => {
      const x = i * pointWidth;
      const y = waveformCenter - (point.sentiment * waveformAmplitude * 0.5);
      
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve
        const prevX = (i - 1) * pointWidth;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(cpX, y, x, y);
      }
    });
    
    ctx.lineTo(width, waveformCenter);
    ctx.closePath();
    
    // Gradient fill for sentiment
    const sentimentGradient = ctx.createLinearGradient(0, 0, 0, height);
    sentimentGradient.addColorStop(0, `${KINETIC_COLORS.trusted}40`);
    sentimentGradient.addColorStop(0.5, `${KINETIC_COLORS.neutral}20`);
    sentimentGradient.addColorStop(1, `${KINETIC_COLORS.hostile}40`);
    ctx.fillStyle = sentimentGradient;
    ctx.fill();
    
    // Draw heat waveform (main line)
    ctx.beginPath();
    ctx.lineWidth = 2;
    
    visibleData.forEach((point, i) => {
      const x = i * pointWidth;
      const normalizedHeat = point.heat / 100;
      const y = height - (normalizedHeat * (height - 40)) - 20;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * pointWidth;
        const prevPoint = visibleData[i - 1];
        const prevY = height - ((prevPoint.heat / 100) * (height - 40)) - 20;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });
    
    // Gradient stroke for heat
    const heatGradient = ctx.createLinearGradient(0, height, 0, 0);
    heatGradient.addColorStop(0, KINETIC_COLORS.cold);
    heatGradient.addColorStop(0.5, KINETIC_COLORS.warm);
    heatGradient.addColorStop(0.8, KINETIC_COLORS.hot);
    heatGradient.addColorStop(1, KINETIC_COLORS.critical);
    ctx.strokeStyle = heatGradient;
    ctx.stroke();
    
    // Draw event markers
    visibleData.forEach((point, i) => {
      if (point.events.length === 0) return;
      
      const x = i * pointWidth;
      const criticalEvent = point.events.find(e => e.severity === 'CRITICAL' || e.severity === 'HIGH');
      
      if (criticalEvent) {
        // Draw marker spike
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 15);
        ctx.strokeStyle = SEVERITY_COLORS[criticalEvent.severity];
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw marker dot
        ctx.beginPath();
        ctx.arc(x, height - 18, 4, 0, Math.PI * 2);
        ctx.fillStyle = SEVERITY_COLORS[criticalEvent.severity];
        ctx.fill();
      }
    });
    
    // Draw scrubber position line
    const scrubX = (scrubPosition - visibleRange.start / data.length) * width * zoomLevel;
    if (scrubX >= 0 && scrubX <= width) {
      ctx.beginPath();
      ctx.moveTo(scrubX, 0);
      ctx.lineTo(scrubX, height);
      ctx.strokeStyle = KINETIC_COLORS.neonCyan;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Scrubber handle
      ctx.beginPath();
      ctx.arc(scrubX, 10, 6, 0, Math.PI * 2);
      ctx.fillStyle = KINETIC_COLORS.neonCyan;
      ctx.fill();
    }
    
  }, [data, width, height, visibleRange, scrubPosition, zoomLevel]);
  
  // Handle mouse events
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    setMouseX(x);
    
    // Find events at this position
    const pointWidth = width / (visibleRange.end - visibleRange.start);
    const index = Math.floor(x / pointWidth) + visibleRange.start;
    
    if (index >= 0 && index < data.length) {
      const point = data[index];
      if (point.events.length > 0) {
        setHoveredEvent(point.events[0]);
      } else {
        setHoveredEvent(null);
      }
    }
  }, [data, width, visibleRange]);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const position = (x / width) / zoomLevel + (visibleRange.start / data.length);
    onScrub(Math.max(0, Math.min(1, position)));
    
    // Check for event click
    if (hoveredEvent) {
      onEventClick(hoveredEvent);
    }
  }, [width, zoomLevel, visibleRange, data.length, onScrub, hoveredEvent, onEventClick]);
  
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="cursor-crosshair"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      
      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredEvent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute pointer-events-none z-10"
            style={{
              left: mouseX,
              top: -60,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="px-3 py-2 rounded-lg bg-black/90 backdrop-blur-sm border border-white/10 shadow-xl whitespace-nowrap">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: SEVERITY_COLORS[hoveredEvent.severity] }}
                />
                <span className="text-xs font-bold text-white">{hoveredEvent.type}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(hoveredEvent.timestamp).toLocaleTimeString()}
              </div>
              {hoveredEvent.content && (
                <div className="text-xs text-gray-300 mt-1 max-w-48 truncate">
                  {hoveredEvent.content}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ====================================
// TIME RULER
// ====================================

interface TimeRulerProps {
  startTime: number;
  endTime: number;
  width: number;
  scrubPosition: number;
}

function TimeRuler({ startTime, endTime, width, scrubPosition }: TimeRulerProps) {
  const markers = useMemo(() => {
    const duration = endTime - startTime;
    const markerCount = 10;
    const result = [];
    
    for (let i = 0; i <= markerCount; i++) {
      const position = i / markerCount;
      const time = new Date(startTime + duration * position);
      result.push({
        position: position * width,
        label: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
    
    return result;
  }, [startTime, endTime, width]);
  
  return (
    <div className="relative h-6" style={{ width }}>
      {markers.map((marker, i) => (
        <div
          key={i}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: marker.position, transform: 'translateX(-50%)' }}
        >
          <div className="w-px h-2 bg-gray-600" />
          <span className="text-[10px] text-gray-500 font-mono">{marker.label}</span>
        </div>
      ))}
      
      {/* Current time indicator */}
      <div
        className="absolute top-0 text-xs font-mono text-avenlo-cyan"
        style={{ 
          left: scrubPosition * width, 
          transform: 'translateX(-50%)',
        }}
      >
        ▼
      </div>
    </div>
  );
}

// ====================================
// FORENSIC SCRUBBER (Main Export)
// ====================================

interface ForensicScrubberProps {
  data: WaveformPoint[];
  startTime: number;
  endTime: number;
  width?: number;
  height?: number;
  className?: string;
  onEventClick?: (event: TimelineEvent) => void;
  onTimeChange?: (timestamp: number) => void;
}

export default function ForensicScrubber({
  data,
  startTime,
  endTime,
  width = 800,
  height = WAVEFORM_HEIGHT,
  className = '',
  onEventClick,
  onTimeChange,
}: ForensicScrubberProps) {
  const [scrubPosition, setScrubPosition] = useState(0.5);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number>();
  
  // Playback animation
  useEffect(() => {
    if (!isPlaying) return;
    
    const animate = () => {
      setScrubPosition(prev => {
        const next = prev + 0.001;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);
  
  // Notify time changes
  useEffect(() => {
    const timestamp = startTime + (endTime - startTime) * scrubPosition;
    onTimeChange?.(timestamp);
  }, [scrubPosition, startTime, endTime, onTimeChange]);
  
  const handleScrub = useCallback((position: number) => {
    setScrubPosition(position);
    setIsPlaying(false);
  }, []);
  
  const handleEventClick = useCallback((event: TimelineEvent) => {
    onEventClick?.(event);
  }, [onEventClick]);
  
  const handleZoomIn = () => setZoomLevel(prev => Math.min(10, prev * 1.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(1, prev / 1.5));
  const handleSkipBack = () => setScrubPosition(prev => Math.max(0, prev - 0.1));
  const handleSkipForward = () => setScrubPosition(prev => Math.min(1, prev + 0.1));
  
  // Current time display
  const currentTime = useMemo(() => {
    return new Date(startTime + (endTime - startTime) * scrubPosition);
  }, [startTime, endTime, scrubPosition]);
  
  // Event counts
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {
      INFRACTION: 0,
      HEAT_SPIKE: 0,
      RAID_ALERT: 0,
    };
    
    data.forEach(point => {
      point.events.forEach(event => {
        if (counts[event.type] !== undefined) {
          counts[event.type]++;
        }
      });
    });
    
    return counts;
  }, [data]);
  
  return (
    <div 
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: KINETIC_COLORS.background }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-white">Forensic Timeline</h3>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
              {eventCounts.INFRACTION} infractions
            </span>
            <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400">
              {eventCounts.HEAT_SPIKE} spikes
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">
            {currentTime.toLocaleTimeString()}
          </span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">
            Zoom: {zoomLevel.toFixed(1)}x
          </span>
        </div>
      </div>
      
      {/* Waveform */}
      <div className="p-4">
        <WaveformRenderer
          data={data}
          width={width - 32}
          height={height}
          scrubPosition={scrubPosition}
          zoomLevel={zoomLevel}
          onScrub={handleScrub}
          onEventClick={handleEventClick}
        />
        
        {/* Time ruler */}
        <TimeRuler
          startTime={startTime}
          endTime={endTime}
          width={width - 32}
          scrubPosition={scrubPosition}
        />
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSkipBack}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <SkipBack className="w-4 h-4 text-gray-400" />
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-lg bg-avenlo-cyan/20 hover:bg-avenlo-cyan/30 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-avenlo-cyan" />
            ) : (
              <Play className="w-4 h-4 text-avenlo-cyan" />
            )}
          </button>
          
          <button
            onClick={handleSkipForward}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <SkipForward className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        {/* Scrub slider */}
        <div className="flex-1 mx-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={scrubPosition}
            onChange={(e) => handleScrub(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-avenlo-cyan"
          />
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <ZoomOut className="w-4 h-4 text-gray-400" />
          </button>
          
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 10}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <ZoomIn className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
