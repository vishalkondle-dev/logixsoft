import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ImageTransform, CornerPoint, FilterMode, GridMode, ColorSample } from '../types';
import { applyArtistFilter, samplePixelColor } from '../utils/filterEngine';
import { computeHomographyMatrix } from '../utils/perspective';

interface CanvasViewportProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sourceImageUrl: string;
  opacity: number;
  peekOpacity: number | null; // When holding peek button
  transform: ImageTransform;
  onUpdateTransform: (updater: (prev: ImageTransform) => ImageTransform) => void;
  filterMode: FilterMode;
  posterizeLevels: number;
  gridMode: GridMode;
  isCalibrating: boolean;
  corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  onUpdateCorner: (index: number, pt: CornerPoint) => void;
  isEyedropperActive: boolean;
  onColorSampled: (sample: ColorSample | null) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  videoRef,
  sourceImageUrl,
  opacity,
  peekOpacity,
  transform,
  onUpdateTransform,
  filterMode,
  posterizeLevels,
  gridMode,
  isCalibrating,
  corners,
  onUpdateCorner,
  isEyedropperActive,
  onColorSampled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawImageRef = useRef<HTMLImageElement | null>(null);
  const filteredCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Gesture state
  const isDraggingRef = useRef<boolean>(false);
  const startDragRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startTransformRef = useRef<ImageTransform>(transform);
  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialTouchAngleRef = useRef<number | null>(null);

  // Active corner drag
  const [activeCornerIdx, setActiveCornerIdx] = useState<number | null>(null);

  // Current applied opacity
  const currentOpacity = peekOpacity !== null ? peekOpacity : opacity;

  // Load and cache source image
  useEffect(() => {
    if (!sourceImageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = sourceImageUrl;
    img.onload = () => {
      rawImageRef.current = img;
      // Re-apply filter
      const processed = applyArtistFilter(img, filterMode, posterizeLevels);
      filteredCanvasRef.current = processed;
      renderOverlay();
    };
  }, [sourceImageUrl, filterMode, posterizeLevels]);

  // Render processed image onto the overlay canvas
  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !filteredCanvasRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = filteredCanvasRef.current.width;
    canvas.height = filteredCanvasRef.current.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(filteredCanvasRef.current, 0, 0);
  }, []);

  // Render Grid Overlay
  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    if (!gridCanvas) return;
    const ctx = gridCanvas.getContext('2d');
    if (!ctx) return;

    const width = gridCanvas.clientWidth;
    const height = gridCanvas.clientHeight;
    gridCanvas.width = width;
    gridCanvas.height = height;

    ctx.clearRect(0, 0, width, height);
    if (gridMode === 'none') return;

    ctx.strokeStyle = '#06b6d4'; // High-visibility Cyan
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    if (gridMode === '3x3') {
      const stepX = width / 3;
      const stepY = height / 3;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(stepX * i, 0);
        ctx.lineTo(stepX * i, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, stepY * i);
        ctx.lineTo(width, stepY * i);
        ctx.stroke();
      }
    } else if (gridMode === '4x4') {
      const stepX = width / 4;
      const stepY = height / 4;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(stepX * i, 0);
        ctx.lineTo(stepX * i, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, stepY * i);
        ctx.lineTo(width, stepY * i);
        ctx.stroke();
      }
    } else if (gridMode === '8x8') {
      const stepX = width / 8;
      const stepY = height / 8;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(stepX * i, 0);
        ctx.lineTo(stepX * i, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, stepY * i);
        ctx.lineTo(width, stepY * i);
        ctx.stroke();
      }
    } else if (gridMode === 'golden') {
      // Golden ratio lines (approx 0.618 and 0.382)
      const gx1 = width * 0.382;
      const gx2 = width * 0.618;
      const gy1 = height * 0.382;
      const gy2 = height * 0.618;

      [gx1, gx2].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });

      [gy1, gy2].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });
    }
  }, [gridMode]);

  // Handle Eyedropper click/touch
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCalibrating && activeCornerIdx !== null) return;

    if (isEyedropperActive && filteredCanvasRef.current && overlayCanvasRef.current) {
      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / rect.width;
      const clickY = (e.clientY - rect.top) / rect.height;

      if (clickX >= 0 && clickX <= 1 && clickY >= 0 && clickY <= 1) {
        const sample = samplePixelColor(filteredCanvasRef.current, clickX, clickY);
        if (sample) {
          let desc = 'Balanced Tone';
          if (sample.luminance > 75) desc = 'Highlight';
          else if (sample.luminance < 25) desc = 'Deep Shadow';
          else if (sample.luminance < 50) desc = 'Core Shadow';
          else desc = 'Midtone';

          onColorSampled({ ...sample, description: desc });
        }
      }
      return;
    }

    // Otherwise standard pan drag
    isDraggingRef.current = true;
    startDragRef.current = { x: e.clientX, y: e.clientY };
    startTransformRef.current = { ...transform };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Corner calibration drag
    if (isCalibrating && activeCornerIdx !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      onUpdateCorner(activeCornerIdx, { x, y });
      return;
    }

    if (!isDraggingRef.current) return;

    const dx = e.clientX - startDragRef.current.x;
    const dy = e.clientY - startDragRef.current.y;

    onUpdateTransform(prev => ({
      ...prev,
      x: startTransformRef.current.x + dx,
      y: startTransformRef.current.y + dy,
    }));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setActiveCornerIdx(null);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    onUpdateTransform(prev => ({
      ...prev,
      scale: Math.max(0.2, Math.min(6, prev.scale * zoomFactor)),
    }));
  };

  // Touch gestures (Pinch-to-zoom & two-finger rotate)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

      initialTouchDistanceRef.current = dist;
      initialTouchAngleRef.current = angle;
      startTransformRef.current = { ...transform };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistanceRef.current && initialTouchAngleRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

      const scaleChange = dist / initialTouchDistanceRef.current;
      const angleChange = ((angle - initialTouchAngleRef.current) * 180) / Math.PI;

      onUpdateTransform(prev => ({
        ...prev,
        scale: Math.max(0.2, Math.min(6, startTransformRef.current.scale * scaleChange)),
        rotation: (startTransformRef.current.rotation + angleChange) % 360,
      }));
    }
  };

  const handleTouchEnd = () => {
    initialTouchDistanceRef.current = null;
    initialTouchAngleRef.current = null;
  };

  // Dynamic CSS transform matrix
  const containerW = containerRef.current?.clientWidth || 800;
  const containerH = containerRef.current?.clientHeight || 600;

  const homographyMatrix = isCalibrating
    ? computeHomographyMatrix(containerW, containerH, corners)
    : undefined;

  const transformStyle: React.CSSProperties = isCalibrating && homographyMatrix
    ? {
        transform: homographyMatrix,
        transformOrigin: '0 0',
      }
    : {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale}) rotate(${transform.rotation}deg) scale(${transform.flipH ? -1 : 1}, ${transform.flipV ? -1 : 1})`,
        transformOrigin: 'center center',
      };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-full overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing"
    >
      {/* 1. Live Camera Stream Background */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* 2. Reference Image Overlay Layer */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150"
        style={{
          opacity: currentOpacity / 100,
        }}
      >
        <div
          style={transformStyle}
          className="transition-transform duration-75 will-change-transform"
        >
          <canvas
            ref={overlayCanvasRef}
            className="max-w-[85vw] max-h-[80vh] object-contain shadow-2xl rounded-sm"
          />
        </div>
      </div>

      {/* 3. Grid Lines Overlay */}
      <canvas
        ref={gridCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 4. 4-Corner Calibration Handles (Only when Align Paper is active) */}
      {isCalibrating && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {/* Connecting Box Outline */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <polygon
              points={`${corners[0].x},${corners[0].y} ${corners[1].x},${corners[1].y} ${corners[2].x},${corners[2].y} ${corners[3].x},${corners[3].y}`}
              fill="rgba(245, 158, 11, 0.15)"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </svg>

          {/* Draggable Corner Points */}
          {corners.map((corner, index) => {
            const labels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
            return (
              <div
                key={index}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setActiveCornerIdx(index);
                }}
                style={{
                  left: `${corner.x}px`,
                  top: `${corner.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto w-10 h-10 flex items-center justify-center cursor-move group"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-xl shadow-amber-500/50 flex items-center justify-center group-hover:scale-125 transition-transform">
                  <span className="w-1.5 h-1.5 rounded-full bg-paper-950" />
                </div>
                <span className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded bg-paper-900/90 text-amber-400 border border-amber-500/30 shadow-md">
                  {labels[index]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
