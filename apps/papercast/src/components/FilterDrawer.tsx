import React from 'react';
import { X, Sparkles, Check, Sliders } from 'lucide-react';
import { FilterMode } from '../types';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilter: FilterMode;
  onSelectFilter: (filter: FilterMode) => void;
  posterizeLevels: number;
  onChangePosterizeLevels: (val: number) => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  currentFilter,
  onSelectFilter,
  posterizeLevels,
  onChangePosterizeLevels,
}) => {
  if (!isOpen) return null;

  const filters: { id: FilterMode; title: string; desc: string; badge: string }[] = [
    {
      id: 'normal',
      title: 'Original Reference',
      desc: 'Full-color natural image with no shader alterations.',
      badge: 'Default',
    },
    {
      id: 'edges',
      title: 'Sobel Edge Contour',
      desc: 'Isolates structural lines and outlines, stripping away complex texture.',
      badge: 'Best for Tracing',
    },
    {
      id: 'posterize',
      title: 'Tonal Posterization',
      desc: 'Breaks gradients into discrete shadow, midtone, and highlight planes.',
      badge: 'Chiaroscuro / Shading',
    },
    {
      id: 'stencil',
      title: 'High-Contrast Stencil',
      desc: 'Pure 1-bit black/white stamp. Ideal for tattoo transfers and cookie decorating.',
      badge: 'Stencils & Stamps',
    },
    {
      id: 'grayscale',
      title: 'Grayscale Value Map',
      desc: 'Removes color distractions to focus solely on values and contrast.',
      badge: 'Value Training',
    },
    {
      id: 'invert',
      title: 'Negative / Invert',
      desc: 'Inverts colors. Perfect for sketching with white gel pen on black paper.',
      badge: 'Dark Canvas',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] bg-paper-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Artist Shaders & Filters</h3>
              <p className="text-xs text-paper-300">Convert complex photos into easy tracing guides</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {filters.map((f) => {
            const isSelected = currentFilter === f.id;
            return (
              <div
                key={f.id}
                onClick={() => onSelectFilter(f.id)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{f.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-xs text-paper-300 leading-relaxed">{f.desc}</p>
                </div>

                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected
                    ? 'bg-amber-500 border-amber-400 text-paper-950'
                    : 'border-white/20'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            );
          })}

          {/* Posterize Levels Control (if Posterize selected) */}
          {currentFilter === 'posterize' && (
            <div className="mt-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Tonal Value Bands
                </span>
                <span className="font-mono">{posterizeLevels} Levels</span>
              </div>
              <input
                type="range"
                min="2"
                max="8"
                step="1"
                value={posterizeLevels}
                onChange={(e) => onChangePosterizeLevels(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
              <span className="text-[11px] text-paper-300">
                Fewer levels create bold high-contrast shadow shapes; higher levels reveal subtle halftones.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
