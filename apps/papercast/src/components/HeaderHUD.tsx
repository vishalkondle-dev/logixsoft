import React from 'react';
import { 
  Zap, 
  ZapOff, 
  Sun, 
  Camera, 
  CircleDot, 
  Square, 
  HelpCircle, 
  Eye, 
  Compass, 
  Layers 
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
  isCalibrating: boolean;
  onToggleCalibrate: () => void;
  isEyedropperActive: boolean;
  onToggleEyedropper: () => void;
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
  isCalibrating,
  onToggleCalibrate,
  isEyedropperActive,
  onToggleEyedropper,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5 pointer-events-auto bg-paper-900/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-xl">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Eye className="w-4 h-4 text-paper-950 stroke-[2.5]" />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
            Papercast
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              AR
            </span>
          </span>
          <span className="text-[10px] text-paper-300 font-medium">Camera Lucida Studio</span>
        </div>
      </div>

      {/* Recording indicator & Duration (if active) */}
      {isRecording && (
        <div className="pointer-events-auto flex items-center gap-2 bg-red-950/80 backdrop-blur-md border border-red-500/40 text-red-400 px-3 py-1.5 rounded-full animate-pulse shadow-lg shadow-red-900/30">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="font-mono text-xs font-bold text-white">{formatTime(recordingDuration)}</span>
          <span className="text-[11px] text-red-300 uppercase tracking-wider font-semibold">REC</span>
        </div>
      )}

      {/* Quick Action Pills */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Paper Calibration Mode */}
        <button
          onClick={onToggleCalibrate}
          title={isCalibrating ? "Exit Corner Calibration" : "4-Corner Paper Perspective"}
          className={`h-10 px-3 rounded-2xl border flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md transition-all shadow-md ${
            isCalibrating
              ? 'bg-amber-500 text-paper-950 border-amber-400 shadow-amber-500/30 font-bold'
              : 'bg-paper-900/80 text-white border-white/10 hover:bg-white/10'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span className="hidden sm:inline">{isCalibrating ? 'Calibrating...' : 'Align Paper'}</span>
        </button>

        {/* Eyedropper / Color Picker Toggle */}
        <button
          onClick={onToggleEyedropper}
          title="Sample Color & Lightness"
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center backdrop-blur-md transition-all shadow-md ${
            isEyedropperActive
              ? 'bg-sky-500 text-paper-950 border-sky-400 shadow-sky-500/30'
              : 'bg-paper-900/80 text-white border-white/10 hover:bg-white/10'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Torch (Flashlight) */}
        {hasTorch && (
          <button
            onClick={toggleTorch}
            title={isTorchOn ? "Turn Off Torch" : "Turn On Canvas Light"}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center backdrop-blur-md transition-all shadow-md ${
              isTorchOn
                ? 'bg-amber-400 text-paper-950 border-amber-300 shadow-amber-400/40'
                : 'bg-paper-900/80 text-white border-white/10 hover:bg-white/10'
            }`}
          >
            {isTorchOn ? <Sun className="w-4 h-4 fill-current" /> : <Zap className="w-4 h-4" />}
          </button>
        )}

        {/* Screen Wake Lock Status */}
        <button
          onClick={requestWakeLock}
          title={isWakeLockActive ? "Screen Awake Active" : "Click to Keep Screen Awake"}
          className={`hidden sm:flex w-10 h-10 rounded-2xl border items-center justify-center backdrop-blur-md transition-all shadow-md ${
            isWakeLockActive
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
              : 'bg-paper-900/80 text-white/50 border-white/10 hover:text-white'
          }`}
        >
          {isWakeLockActive ? <Zap className="w-4 h-4 fill-current text-emerald-400" /> : <ZapOff className="w-4 h-4" />}
        </button>

        {/* Camera Switcher (if multiple cameras available) */}
        {devices.length > 1 && (
          <div className="relative group">
            <button
              title="Switch Camera Lens"
              className="w-10 h-10 rounded-2xl border border-white/10 bg-paper-900/80 text-white flex items-center justify-center backdrop-blur-md hover:bg-white/10 shadow-md"
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

        {/* Clean Video Recording Trigger */}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          title={isRecording ? "Stop Recording Session" : "Record Clean Drawing Time-lapse"}
          className={`h-10 px-3 rounded-2xl border flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition-all shadow-md ${
            isRecording
              ? 'bg-red-600 text-white border-red-500 shadow-red-600/30'
              : 'bg-paper-900/80 text-white border-white/10 hover:bg-white/10'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <CircleDot className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Record</span>
            </>
          )}
        </button>

        {/* Help Guide */}
        <button
          onClick={onOpenGuide}
          title="Setup & Tracing Guide"
          className="w-10 h-10 rounded-2xl border border-white/10 bg-paper-900/80 text-white flex items-center justify-center backdrop-blur-md hover:bg-white/10 shadow-md"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
