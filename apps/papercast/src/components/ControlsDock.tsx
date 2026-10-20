import React from 'react';
import { 
  Sliders, 
  Eye, 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical, 
  Grid, 
  Sparkles, 
  FolderOpen, 
  RotateCcw,
  Timer
} from 'lucide-react';
import { FilterMode, GridMode } from '../types';

interface ControlsDockProps {
  opacity: number;
  onChangeOpacity: (val: number) => void;
  onHoldPeekStart: () => void;
  onHoldPeekEnd: () => void;
  isPeeking: boolean;
  strobeSpeed: number; // 0 = off, 0.5, 1, 2
  onCycleStrobe: () => void;
  onRotate90: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onResetTransform: () => void;
  currentFilter: FilterMode;
  onOpenFilterDrawer: () => void;
  currentGrid: GridMode;
  onCycleGrid: () => void;
  onOpenPresetsDrawer: () => void;
}

export const ControlsDock: React.FC<ControlsDockProps> = ({
  opacity,
  onChangeOpacity,
  onHoldPeekStart,
  onHoldPeekEnd,
  isPeeking,
  strobeSpeed,
  onCycleStrobe,
  onRotate90,
  onFlipH,
  onFlipV,
  onResetTransform,
  currentFilter,
  onOpenFilterDrawer,
  currentGrid,
  onCycleGrid,
  onOpenPresetsDrawer,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-5 flex flex-col items-center pointer-events-none">
      <div className="w-full max-w-xl flex flex-col gap-2.5 pointer-events-auto">
        
        {/* Floating Quick Action Bar */}
        <div className="flex items-center justify-between bg-paper-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 sm:p-2.5 shadow-2xl">
          
          {/* Presets & Image Upload */}
          <button
            onClick={onOpenPresetsDrawer}
            title="Choose Tracing Art or Upload Image"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Reference</span>
          </button>

          {/* Artist Filters Trigger */}
          <button
            onClick={onOpenFilterDrawer}
            title="Artist Shaders & Edge Detection"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="capitalize hidden sm:inline">{currentFilter}</span>
          </button>

          {/* Grid Mode Selector */}
          <button
            onClick={onCycleGrid}
            title={`Current Grid: ${currentGrid}. Click to toggle`}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
              currentGrid !== 'none'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-mono uppercase">{currentGrid}</span>
          </button>

          {/* Auto-Strobe / Blink Mode */}
          <button
            onClick={onCycleStrobe}
            title={strobeSpeed === 0 ? "Enable Auto-Strobe / Blink" : `Strobe: ${strobeSpeed}s`}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
              strobeSpeed > 0
                ? 'bg-purple-500/25 border-purple-500/40 text-purple-300 shadow-md shadow-purple-900/30'
                : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
            }`}
          >
            <Timer className="w-4 h-4 text-purple-400" />
            <span className="text-[11px] font-mono">{strobeSpeed > 0 ? `${strobeSpeed}s` : 'Strobe'}</span>
          </button>

          {/* Transform shortcuts */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <button
              onClick={onRotate90}
              title="Rotate 90° Clockwise"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFlipH}
              title="Flip Horizontal (Mirror)"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFlipV}
              title="Flip Vertical"
              className="hidden sm:flex w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 items-center justify-center text-white/80 hover:text-white"
            >
              <FlipVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetTransform}
              title="Reset Transform (Center, 100%)"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Primary Opacity Control & Hold-to-Peek Bar */}
        <div className="flex items-center gap-3 bg-paper-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl px-4 py-3 shadow-2xl">
          
          {/* Hold to Peek Button */}
          <button
            onPointerDown={onHoldPeekStart}
            onPointerUp={onHoldPeekEnd}
            onPointerCancel={onHoldPeekEnd}
            title="Press and Hold to hide reference and see your real drawing!"
            className={`h-11 px-3.5 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all shadow-lg active:scale-95 ${
              isPeeking
                ? 'bg-amber-400 text-paper-950 shadow-amber-400/50 scale-105'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="whitespace-nowrap hidden sm:inline">Hold to Peek</span>
          </button>

          {/* Opacity Slider */}
          <div className="flex-1 flex items-center gap-3">
            <span className="text-[11px] font-mono text-paper-300 font-semibold w-7 text-right">
              {opacity}%
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => onChangeOpacity(Number(e.target.value))}
              className="w-full h-2 cursor-pointer"
            />
          </div>

          <Sliders className="w-4 h-4 text-paper-300 hidden sm:block" />
        </div>

      </div>
    </div>
  );
};
