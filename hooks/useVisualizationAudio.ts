import { useState, useRef, useCallback, useEffect } from 'react';

export interface VisualizationAudioState {
  isPlaying: boolean;
  isLooping: boolean;
}

export interface VisualizationAudioActions {
  prepareFromPcm: (base64: string) => Promise<void>;
  prepareFromUrl: (url: string) => Promise<void>;
  togglePlay: (audioUrl?: string, audioData?: string) => Promise<void>;
  toggleLoop: () => void;
  stop: () => void;
  cleanup: () => void;
}

export function useVisualizationAudio(): VisualizationAudioState & VisualizationAudioActions {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const loopRef = useRef(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

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
    setIsPlaying(false);
  }, []);

  const playBuffer = useCallback((loop: boolean) => {
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
    source.onended = () => { if (!source.loop) setIsPlaying(false); };
    source.start();
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
    htmlAudioRef.current = audio;
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
    // PCM buffer playback
    if (isPlaying) stop();
    else playBuffer(loopRef.current);
  }, [isPlaying, playBuffer, stop]);

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

  return { isPlaying, isLooping, prepareFromPcm, prepareFromUrl, togglePlay, toggleLoop, stop, cleanup };
}
