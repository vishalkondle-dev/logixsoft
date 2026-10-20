import React from 'react';
import { X, Smartphone, Eye, Sparkles, Video, Compass } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] bg-paper-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">How to Use Papercast</h3>
              <p className="text-xs text-paper-300">Modern Camera Lucida drawing guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5 text-sm text-paper-200">
          
          {/* Step 1: Physical Setup */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white text-sm">1. Mount Your Phone or Tablet</h4>
              <p className="text-xs text-paper-300 leading-relaxed">
                Place your phone horizontally on a coffee mug, glass, shelf, or gooseneck clamp pointing down at your drawing paper. Keeping the phone stationary ensures rock-solid alignment.
              </p>
            </div>
          </div>

          {/* Step 2: Opacity & Hold to Peek */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Eye className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white text-sm">2. Master the "Hold to Peek" Button</h4>
              <p className="text-xs text-paper-300 leading-relaxed">
                Draw with your real pencil while looking at your screen. Whenever you want to inspect your real pencil lines without the ghost reference, <strong>press & hold "Hold to Peek"</strong> to drop the reference to 0% opacity. Release it to bring the guide back!
              </p>
            </div>
          </div>

          {/* Step 3: Shaders */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white text-sm">3. Use Sobel Edges & Posterize</h4>
              <p className="text-xs text-paper-300 leading-relaxed">
                Switch to <strong>Sobel Edge</strong> mode to turn photos into crisp tracing outlines. Switch to <strong>Posterize</strong> mode to see step-by-step value zones for shading like the Old Masters.
              </p>
            </div>
          </div>

          {/* Step 4: Paper Alignment */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white text-sm">4. Align Paper (Perspective Homography)</h4>
              <p className="text-xs text-paper-300 leading-relaxed">
                If your phone is tilted at an angle, tap <strong>Align Paper</strong> and drag the 4 corner pins to match the 4 corners of your paper sheet. The image will perspective-warp to fit your desk perfectly.
              </p>
            </div>
          </div>

          {/* Step 5: Clean Video Recording */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Video className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white text-sm">5. Record Clean Drawing Time-lapses</h4>
              <p className="text-xs text-paper-300 leading-relaxed">
                Tap <strong>Record</strong> to capture your drawing session. Papercast records only the raw camera stream—meaning your finished time-lapse contains <em>only</em> your physical hand and artwork, with zero digital overlay!
              </p>
            </div>
          </div>

        </div>

        <div className="p-4 sm:p-5 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-paper-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            Got It, Let's Draw!
          </button>
        </div>
      </div>
    </div>
  );
};
