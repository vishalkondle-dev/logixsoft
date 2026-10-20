import React, { useState, useRef } from 'react';
import { X, Download, Play, FastForward, Check } from 'lucide-react';

interface VideoRecordingModalProps {
  videoUrl: string | null;
  onClose: () => void;
}

export const VideoRecordingModal: React.FC<VideoRecordingModalProps> = ({
  videoUrl,
  onClose,
}) => {
  const [speed, setSpeed] = useState<number>(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!videoUrl) return null;

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `papercast-timelapse-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-paper-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Clean Drawing Time-lapse</h3>
              <p className="text-xs text-paper-300">Only your physical paper & hands were recorded</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center relative">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              loop
              className="w-full h-full object-contain"
            />
          </div>

          {/* Speed Selector */}
          <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-2xl border border-white/10">
            <span className="text-xs font-bold text-white/80 flex items-center gap-1.5 pl-1">
              <FastForward className="w-3.5 h-3.5 text-amber-400" />
              Playback Speed
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    speed === s
                      ? 'bg-amber-500 text-paper-950 font-extrabold shadow-md'
                      : 'bg-white/5 text-white/70 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-paper-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              Download Time-lapse (.webm)
            </button>
            <button
              onClick={onClose}
              className="py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
