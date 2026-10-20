import { useState, useEffect, useRef, useCallback } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const wakeLockRef = useRef<any>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Request & acquire camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('Initial camera constraints failed, attempting basic environment fallback:', err);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'environment' }
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.defaultMuted = true;

        const playVideo = async () => {
          try {
            await video.play();
          } catch (playErr) {
            console.warn('Video play delayed/blocked by policy:', playErr);
          }
        };

        if (video.readyState >= 2) {
          playVideo();
        } else {
          video.onloadedmetadata = playVideo;
        }
      }

      setHasPermission(true);
      setErrorMsg(null);

      // Check capabilities for torch
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities?.() || {};
        setHasTorch(Boolean(capabilities.torch));
        setIsTorchOn(false);
      }

      // Enumerate devices
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);

        const currentTrack = stream.getVideoTracks()[0];
        if (currentTrack) {
          const settings = currentTrack.getSettings();
          if (settings.deviceId) {
            setActiveDeviceId(settings.deviceId);
          }
        }
      } catch (e) {
        console.warn('Enumerate devices failed:', e);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setErrorMsg(err.message || 'Unable to access camera. Please allow permissions.');
    }
  }, []);

  // Torch Toggle
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    try {
      const next = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }]
      });
      setIsTorchOn(next);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  }, [isTorchOn]);

  // Screen Wake Lock
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setIsWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setIsWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
      } catch (err) {
        console.warn('Wake lock release error:', err);
      }
    }
  }, []);

  // Time-lapse / Clean Video Recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    setRecordedVideoUrl(null);
    setRecordingDuration(0);

    try {
      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      };

      const recorder = new MediaRecorder(streamRef.current, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Resume video playback on user touch/click if stalled
  const resumePlayback = useCallback(() => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(e => console.warn('Resume play failed:', e));
    }
  }, []);

  // Initialize camera and wake lock on mount
  useEffect(() => {
    startCamera();
    requestWakeLock();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      releaseWakeLock();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [startCamera, requestWakeLock, releaseWakeLock]);

  return {
    videoRef,
    hasPermission,
    errorMsg,
    devices,
    activeDeviceId,
    switchCamera: startCamera,
    resumePlayback,
    hasTorch,
    isTorchOn,
    toggleTorch,
    isWakeLockActive,
    requestWakeLock,
    releaseWakeLock,
    isRecording,
    recordingDuration,
    recordedVideoUrl,
    startRecording,
    stopRecording,
    clearRecordedVideo: () => setRecordedVideoUrl(null)
  };
}
