import React from 'react';
import { 
  Zap, 
  Sun, 
  Camera, 
  CircleDot, 
  Square, 
  HelpCircle, 
  Eye, 
  ZapOff 
} from 'lucide-react';

interface HeaderHUDProps {
  hasTorch: boolean;
  isTorchOn: boolean;
  toggleTorch: () => void;
  isWakeLockActive: boolean;
  requestWakeLock: () => void;
  devices: MediaDeviceInfo[];
  activeDeviceId: string;
  onSwitchCamera: (deviceId: string) => void;
  isRecording: boolean;
  recordingDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenGuide: () => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  hasTorch,
  isTorchOn,
  toggleTorch,
  isWakeLockActive,
  requestWakeLock,
  devices,
  activeDeviceId,
  onSwitchCamera,
  isRecording,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  onOpenGuide,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 safe-top-pad px-3.5 sm:px-6 flex items-center justify-between pointer-events-none transition-all">
      {/* Brand Badge */}
      <div className="flex items-center gap-2 pointer-events-auto bg-paper-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/20 shadow-2xl">
        <img 
          src="/favicon-64.png" 
          alt="Papercast Logo" 
          className="w-6 h-6 rounded-lg object-cover shadow-md shadow-amber-500/30 border border-white/10" 
        />
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-xs sm:text-sm tracking-tight text-white antialiased">
            Papercast
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/25 text-amber-400 border border-amber-500/40">
            AR
          </span>
        </div>
      </div>

      {/* Recording Pill (if recording) */}
      {isRecording && (
        <div className="pointer-events-auto flex items-center gap-1.5 bg-red-950/95 backdrop-blur-md border border-red-500/60 text-red-400 px-2.5 py-1 rounded-full animate-pulse shadow-xl shadow-red-900/40">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-mono text-[11px] font-bold text-white">{formatTime(recordingDuration)}</span>
        </div>
      )}

      {/* Device & Session Controls (Right) */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        {/* Flashlight / Torch */}
        {hasTorch && (
          <button
            onClick={toggleTorch}
            title={isTorchOn ? "Turn Off Torch" : "Turn On Canvas Light"}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center backdrop-blur-md transition-all shadow-xl ${
              isTorchOn
                ? 'bg-amber-400 text-paper-950 border-amber-300 shadow-amber-400/40'
                : 'bg-paper-900/95 text-white border-white/20 hover:bg-white/10'
            }`}
          >
            {isTorchOn ? <Sun className="w-4 h-4 fill-current" /> : <Zap className="w-4 h-4" />}
          </button>
        )}

        {/* Screen Wake Lock */}
        <button
          onClick={requestWakeLock}
          title={isWakeLockActive ? "Screen Awake Active" : "Click to Keep Screen Awake"}
          className={`hidden sm:flex w-9 h-9 rounded-xl border items-center justify-center backdrop-blur-md transition-all shadow-xl ${
            isWakeLockActive
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400'
              : 'bg-paper-900/95 text-white/50 border-white/20 hover:text-white'
          }`}
        >
          {isWakeLockActive ? <Zap className="w-4 h-4 fill-current text-emerald-400" /> : <ZapOff className="w-4 h-4" />}
        </button>

        {/* Camera Selector (if multiple lenses) */}
        {devices.length > 1 && (
          <div className="relative group">
            <button
              title="Switch Camera Lens"
              className="w-9 h-9 rounded-xl border border-white/20 bg-paper-900/95 text-white flex items-center justify-center backdrop-blur-md hover:bg-white/10 shadow-xl"
            >
              <Camera className="w-4 h-4" />
            </button>
            <select
              value={activeDeviceId}
              onChange={(e) => onSwitchCamera(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId || idx} value={device.deviceId} className="bg-paper-900 text-white">
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Record Video Button */}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          title={isRecording ? "Stop Recording Session" : "Record Clean Drawing Time-lapse"}
          className={`h-9 px-2.5 sm:px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md transition-all shadow-xl ${
            isRecording
              ? 'bg-red-600 text-white border-red-500 shadow-red-600/40'
              : 'bg-paper-900/95 text-white border-white/20 hover:bg-white/10'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span className="text-[11px] font-bold">Stop</span>
            </>
          ) : (
            <>
              <CircleDot className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline text-[11px]">Record</span>
            </>
          )}
        </button>

        {/* Help Guide */}
        <button
          onClick={onOpenGuide}
          title="Setup & Tracing Guide"
          className="w-9 h-9 rounded-xl border border-white/20 bg-paper-900/95 text-white flex items-center justify-center backdrop-blur-md hover:bg-white/10 shadow-xl"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
