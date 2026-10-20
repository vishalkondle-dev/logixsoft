import React from 'react';
import { X, Palette } from 'lucide-react';
import { ColorSample } from '../types';

interface ColorEyedropperCardProps {
  sample: ColorSample | null;
  onClose: () => void;
}

export const ColorEyedropperCard: React.FC<ColorEyedropperCardProps> = ({
  sample,
  onClose,
}) => {
  if (!sample) return null;

  return (
    <div className="fixed top-20 right-4 z-40 w-72 bg-paper-900/95 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-150">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Tonal Inspector</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Color Swatch */}
        <div
          style={{ backgroundColor: sample.hex }}
          className="w-14 h-14 rounded-2xl border-2 border-white/20 shadow-inner shrink-0"
        />

        <div className="flex flex-col flex-1">
          <span className="font-mono text-sm font-extrabold text-white">{sample.hex}</span>
          <span className="text-xs text-sky-400 font-semibold">{sample.description}</span>
          <span className="text-[11px] text-paper-300 font-mono">
            RGB: {sample.rgb[0]}, {sample.rgb[1]}, {sample.rgb[2]}
          </span>
        </div>
      </div>

      {/* Value / Luminance Gauge */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-paper-300 font-medium">Luminance (Value)</span>
          <span className="font-mono font-bold text-white">{sample.luminance}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
          <div
            style={{ width: `${sample.luminance}%` }}
            className="h-full bg-gradient-to-r from-slate-700 via-amber-400 to-white"
          />
        </div>
      </div>
    </div>
  );
};
