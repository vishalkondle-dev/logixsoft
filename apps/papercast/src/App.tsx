import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCamera } from './hooks/useCamera';
import { HeaderHUD } from './components/HeaderHUD';
import { CanvasViewport } from './components/CanvasViewport';
import { ControlsDock } from './components/ControlsDock';
import { PresetsDrawer } from './components/PresetsDrawer';
import { FilterDrawer } from './components/FilterDrawer';
import { ColorEyedropperCard } from './components/ColorEyedropperCard';
import { VideoRecordingModal } from './components/VideoRecordingModal';
import { GuideModal } from './components/GuideModal';
import { TRACING_PRESETS } from './utils/presets';
import { ImageTransform, CornerPoint, FilterMode, GridMode, ColorSample, TracingPreset } from './types';

export const App: React.FC = () => {
  // Camera & Device Hook
  const {
    videoRef,
    hasPermission,
    errorMsg,
    devices,
    activeDeviceId,
    switchCamera,
    resumePlayback,
    hasTorch,
    isTorchOn,
    toggleTorch,
    isWakeLockActive,
    requestWakeLock,
    isRecording,
    recordingDuration,
    recordedVideoUrl,
    startRecording,
    stopRecording,
    clearRecordedVideo,
  } = useCamera();

  // Reference Image State
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(TRACING_PRESETS[0].id);
  const [sourceImageUrl, setSourceImageUrl] = useState<string>(TRACING_PRESETS[0].sourceUrl);

  // Projection / Opacity State (Default to 50% opacity)
  const [opacity, setOpacity] = useState<number>(50);
  const [peekOpacity, setPeekOpacity] = useState<number | null>(null);
  const [isPeeking, setIsPeeking] = useState<boolean>(false);

  // Auto-Strobe / Blink State
  const [strobeSpeed, setStrobeSpeed] = useState<number>(0);
  const strobeTimerRef = useRef<any>(null);

  // Transform State
  const [transform, setTransform] = useState<ImageTransform>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
  });

  // Paper Corner Calibration State
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [corners, setCorners] = useState<[CornerPoint, CornerPoint, CornerPoint, CornerPoint]>([
    { x: 100, y: 100 },
    { x: 500, y: 100 },
    { x: 500, y: 450 },
    { x: 100, y: 450 },
  ]);

  // Filters & Grid State (Default to normal/outline)
  const [filterMode, setFilterMode] = useState<FilterMode>('normal');
  const [posterizeLevels, setPosterizeLevels] = useState<number>(4);
  const [gridMode, setGridMode] = useState<GridMode>('none');

  // Eyedropper & Color Sampling State
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(false);
  const [colorSample, setColorSample] = useState<ColorSample | null>(null);

  // Modals & Drawers
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Initialize initial corner points based on window dimensions
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const padX = Math.round(w * 0.15);
    const padY = Math.round(h * 0.22);
    setCorners([
      { x: padX, y: padY },
      { x: w - padX, y: padY },
      { x: w - padX, y: h - padY },
      { x: padX, y: h - padY },
    ]);
  }, []);

  // Handle Hold-to-Peek
  const handleHoldPeekStart = useCallback(() => {
    setIsPeeking(true);
    setPeekOpacity(0);
  }, []);

  const handleHoldPeekEnd = useCallback(() => {
    setIsPeeking(false);
    setPeekOpacity(null);
  }, []);

  // Handle Auto-Strobe / Blink
  const handleCycleStrobe = useCallback(() => {
    setStrobeSpeed((prev) => {
      if (prev === 0) return 0.5;
      if (prev === 0.5) return 1;
      if (prev === 1) return 2;
      return 0;
    });
  }, []);

  useEffect(() => {
    if (strobeTimerRef.current) {
      clearInterval(strobeTimerRef.current);
      strobeTimerRef.current = null;
    }

    if (strobeSpeed > 0) {
      let isVisible = true;
      strobeTimerRef.current = setInterval(() => {
        isVisible = !isVisible;
        setPeekOpacity(isVisible ? null : 0);
      }, strobeSpeed * 1000);
    } else {
      setPeekOpacity(null);
    }

    return () => {
      if (strobeTimerRef.current) {
        clearInterval(strobeTimerRef.current);
      }
    };
  }, [strobeSpeed]);

  // Handle Grid Cycle
  const handleCycleGrid = useCallback(() => {
    const modes: GridMode[] = ['none', '3x3', '4x4', '8x8', 'golden'];
    setGridMode((prev) => {
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  // Transform shortcuts
  const handleRotate90 = useCallback(() => {
    setTransform(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  }, []);

  const handleFlipH = useCallback(() => {
    setTransform(prev => ({ ...prev, flipH: !prev.flipH }));
  }, []);

  const handleResetTransform = useCallback(() => {
    setTransform({
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    });
  }, []);

  const handleUpdateCorner = useCallback((index: number, pt: CornerPoint) => {
    setCorners((prev) => {
      const next = [...prev] as [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
      next[index] = pt;
      return next;
    });
  }, []);

  const handleSelectPreset = useCallback((preset: TracingPreset) => {
    setSelectedPresetId(preset.id);
    setSourceImageUrl(preset.sourceUrl);
    setFilterMode(preset.recommendedFilter);
  }, []);

  const handleCustomImageLoaded = useCallback((url: string) => {
    setSelectedPresetId(null);
    setSourceImageUrl(url);
    setFilterMode('edges');
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-paper-950 font-sans">
      
      {/* Camera Error / Permission Fallback banner */}
      {hasPermission === false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-paper-950/95 backdrop-blur-md">
          <div className="max-w-md p-6 rounded-3xl bg-paper-900 border border-white/10 flex flex-col items-center text-center gap-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 text-2xl font-bold">
              📷
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-white">Camera Access Needed</h2>
              <p className="text-xs text-paper-300 leading-relaxed">
                {errorMsg || 'Papercast projects images onto your physical paper using your camera. Please allow camera permissions in your browser or Settings.'}
              </p>
            </div>
            <button
              onClick={() => switchCamera()}
              className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-paper-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all"
            >
              Retry Camera Connection
            </button>
          </div>
        </div>
      )}

      {/* Top Header HUD (Safely spaced below Dynamic Island / Notch) */}
      <HeaderHUD
        hasTorch={hasTorch}
        isTorchOn={isTorchOn}
        toggleTorch={toggleTorch}
        isWakeLockActive={isWakeLockActive}
        requestWakeLock={requestWakeLock}
        devices={devices}
        activeDeviceId={activeDeviceId}
        onSwitchCamera={switchCamera}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Interactive Canvas Lucida Viewport */}
      <CanvasViewport
        videoRef={videoRef}
        sourceImageUrl={sourceImageUrl}
        opacity={opacity}
        peekOpacity={peekOpacity}
        transform={transform}
        onUpdateTransform={setTransform}
        filterMode={filterMode}
        posterizeLevels={posterizeLevels}
        gridMode={gridMode}
        isCalibrating={isCalibrating}
        corners={corners}
        onUpdateCorner={handleUpdateCorner}
        isEyedropperActive={isEyedropperActive}
        onColorSampled={setColorSample}
        onResumePlayback={resumePlayback}
      />

      {/* Eyedropper Card */}
      <ColorEyedropperCard
        sample={colorSample}
        onClose={() => {
          setColorSample(null);
          setIsEyedropperActive(false);
        }}
      />

      {/* Floating Bottom Controls Dock (Safely elevated above iOS Home Bar) */}
      <ControlsDock
        opacity={opacity}
        onChangeOpacity={setOpacity}
        onHoldPeekStart={handleHoldPeekStart}
        onHoldPeekEnd={handleHoldPeekEnd}
        isPeeking={isPeeking}
        strobeSpeed={strobeSpeed}
        onCycleStrobe={handleCycleStrobe}
        onRotate90={handleRotate90}
        onFlipH={handleFlipH}
        onResetTransform={handleResetTransform}
        currentFilter={filterMode}
        onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
        currentGrid={gridMode}
        onCycleGrid={handleCycleGrid}
        onOpenPresetsDrawer={() => setIsPresetsOpen(true)}
        isCalibrating={isCalibrating}
        onToggleCalibrate={() => setIsCalibrating(prev => !prev)}
        isEyedropperActive={isEyedropperActive}
        onToggleEyedropper={() => {
          setIsEyedropperActive(prev => !prev);
          if (isEyedropperActive) setColorSample(null);
        }}
      />

      {/* Modals & Drawers */}
      <PresetsDrawer
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        onCustomImageLoaded={handleCustomImageLoaded}
        onApplyRecommendedFilter={setFilterMode}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        currentFilter={filterMode}
        onSelectFilter={(f) => {
          setFilterMode(f);
          setIsFilterDrawerOpen(false);
        }}
        posterizeLevels={posterizeLevels}
        onChangePosterizeLevels={setPosterizeLevels}
      />

      <VideoRecordingModal
        videoUrl={recordedVideoUrl}
        onClose={clearRecordedVideo}
      />

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

    </div>
  );
};
