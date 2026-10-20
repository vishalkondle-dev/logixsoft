import React, { useRef } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { TRACING_PRESETS } from '../utils/presets';
import { TracingPreset, FilterMode } from '../types';

interface PresetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPresetId: string | null;
  onSelectPreset: (preset: TracingPreset) => void;
  onCustomImageLoaded: (url: string) => void;
  onApplyRecommendedFilter: (filter: FilterMode) => void;
}

export const PresetsDrawer: React.FC<PresetsDrawerProps> = ({
  isOpen,
  onClose,
  selectedPresetId,
  onSelectPreset,
  onCustomImageLoaded,
  onApplyRecommendedFilter,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onCustomImageLoaded(result);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[85vh] bg-paper-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Select Reference Image</h3>
              <p className="text-xs text-paper-300">Choose a practice master or upload your own sketch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Button Section */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-2 group transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-white">Upload Your Own Photo or Drawing</span>
            <span className="text-xs text-paper-300">Supports PNG, JPG, WebP, SVG</span>
          </button>
        </div>

        {/* Practice Templates Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Pre-loaded Tracing Studies
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRACING_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => {
                    onSelectPreset(preset);
                    onApplyRecommendedFilter(preset.recommendedFilter);
                    onClose();
                  }}
                  className={`group relative p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2.5 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/50 border border-white/5 flex items-center justify-center relative">
                    <img
                      src={preset.thumbnailUrl}
                      alt={preset.title}
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 text-paper-950 flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                      {preset.title}
                    </span>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-paper-300">
                      <span>{preset.category}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 font-mono text-[10px]">
                        {preset.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
