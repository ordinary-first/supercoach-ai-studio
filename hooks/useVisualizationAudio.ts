import { useState, useRef, useCallback, useEffect } from 'react';

export interface VisualizationAudioState {
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
}

export interface VisualizationAudioActions {
  prepareFromPcm: (base64: string) => Promise<void>;
  prepareFromUrl: (url: string) => Promise<void>;
  togglePlay: (audioUrl?: string, audioData?: string) => Promise<void>;
  toggleLoop: () => void;
  seek: (time: number) => void;
  stop: () => void;
  cleanup: () => void;
}

export function useVisualizationAudio(): VisualizationAudioState & VisualizationAudioActions {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const loopRef = useRef(true);
  // PCM 재생 위치 추적: 소스가 offset 초부터 시작했고, 그 순간의 ctx 시각.
  const pcmOffsetRef = useRef(0);
  const pcmCtxStartRef = useRef(0);
  const lastTickRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* noop */ }
      sourceNodeRef.current = null;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.currentTime = 0;
      htmlAudioRef.current = null;
    }
    pcmOffsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const playBuffer = useCallback((loop: boolean, offset = 0) => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* noop */ }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.loop = loop;
    source.connect(audioCtxRef.current.destination);
    source.onended = () => { if (!source.loop) { setIsPlaying(false); setCurrentTime(0); pcmOffsetRef.current = 0; } };
    const safeOffset = Math.max(0, Math.min(offset, audioBufferRef.current.duration - 0.02));
    source.start(0, safeOffset);
    pcmOffsetRef.current = safeOffset;
    pcmCtxStartRef.current = audioCtxRef.current.currentTime;
    sourceNodeRef.current = source;
    setIsPlaying(true);
  }, []);

  const prepareFromPcm = useCallback(async (base64: string) => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }
    const maybeWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = window.AudioContext || maybeWebkit.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor({ sampleRate: 24000 });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) bytes[i] = binaryString.charCodeAt(i);

    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioCtxRef.current.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) channelData[i] = dataInt16[i] / 32768.0;

    audioBufferRef.current = buffer;
    pcmOffsetRef.current = 0;
    setCurrentTime(0);
    setDuration(buffer.duration);
    playBuffer(true);
  }, [playBuffer]);

  const prepareFromUrl = useCallback(async (audioUrl: string) => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.loop = loopRef.current;
    audio.onended = () => { if (!audio.loop) setIsPlaying(false); };
    audio.onloadedmetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    htmlAudioRef.current = audio;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async (audioUrl?: string, audioData?: string) => {
    // URL-only playback (no PCM buffer)
    if (audioUrl && !audioData && htmlAudioRef.current) {
      if (isPlaying) {
        htmlAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        htmlAudioRef.current.loop = loopRef.current;
        await htmlAudioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    // PCM buffer playback — 마지막 seek 위치(pcmOffset)부터 재생
    if (isPlaying) {
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch { /* noop */ } sourceNodeRef.current = null; }
      setIsPlaying(false);
    } else {
      playBuffer(loopRef.current, pcmOffsetRef.current);
    }
  }, [isPlaying, playBuffer]);

  const seek = useCallback((time: number) => {
    const target = Math.max(0, time);
    if (htmlAudioRef.current) {
      const dur = htmlAudioRef.current.duration;
      htmlAudioRef.current.currentTime = Number.isFinite(dur) ? Math.min(target, dur) : target;
      setCurrentTime(htmlAudioRef.current.currentTime);
      return;
    }
    if (audioBufferRef.current) {
      const clamped = Math.min(target, audioBufferRef.current.duration);
      pcmOffsetRef.current = clamped;
      setCurrentTime(clamped);
      if (isPlaying) playBuffer(loopRef.current, clamped);
    }
  }, [isPlaying, playBuffer]);

  // 재생 중 현재 위치 추적(~12fps 스로틀로 부모 리렌더 억제)
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = (now: number) => {
      if (now - lastTickRef.current > 80) {
        lastTickRef.current = now;
        if (htmlAudioRef.current) {
          setCurrentTime(htmlAudioRef.current.currentTime);
        } else if (audioCtxRef.current && audioBufferRef.current) {
          const dur = audioBufferRef.current.duration;
          let ct = pcmOffsetRef.current + (audioCtxRef.current.currentTime - pcmCtxStartRef.current);
          if (loopRef.current && dur > 0) ct %= dur;
          setCurrentTime(ct);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const toggleLoop = useCallback(() => {
    const next = !loopRef.current;
    loopRef.current = next;
    setIsLooping(next);
    if (sourceNodeRef.current) sourceNodeRef.current.loop = next;
    if (htmlAudioRef.current) htmlAudioRef.current.loop = next;
  }, []);

  const cleanup = useCallback(() => {
    stop();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, [stop]);

  useEffect(() => cleanup, [cleanup]);

  return { isPlaying, isLooping, currentTime, duration, prepareFromPcm, prepareFromUrl, togglePlay, toggleLoop, seek, stop, cleanup };
}
