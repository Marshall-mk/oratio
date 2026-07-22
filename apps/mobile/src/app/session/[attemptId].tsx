import { useAudioRecorder } from '@siteed/audio-studio';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { DeviceCaptionSession } from '@/lib/captions/deviceCaptions';
import { WhisperCaptionSession } from '@/lib/captions/whisperCaptions';
import { isWhisperModelDownloaded } from '@/lib/captions/whisperModel';
import { LiveSocket, type LiveSocketHandlers } from '@/lib/liveSocket';
import { uploadRecording } from '@/lib/recordings';
import { useCaptionEngine } from '@/stores/captionEngine';
import { useColors, type AppColors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

type Phase = 'connecting' | 'recording' | 'finishing' | 'error';
/** 'offline' = whisper chosen but its model isn't downloaded: record-only. */
type Engine = 'gemini' | 'device' | 'whisper' | 'offline';

const READY_TIMEOUT = 8000;
const MAX_RECONNECTS = 3;

export default function SessionScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const { attemptId, challengeId } = useLocalSearchParams<{
    attemptId: string;
    challengeId: string;
  }>();
  const router = useRouter();
  const recorder = useAudioRecorder();

  // Engine is frozen for the take; changing it in Profile applies next time.
  const [engine] = useState<Engine>(() => {
    const chosen = useCaptionEngine.getState().engine;
    if (chosen === 'whisper' && !isWhisperModelDownloaded()) return 'offline';
    return chosen;
  });

  const [phase, setPhase] = useState<Phase>('connecting');
  const [paused, setPaused] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [deviceSeconds, setDeviceSeconds] = useState(0);

  const socketRef = useRef<LiveSocket | null>(null);
  const deviceRef = useRef<DeviceCaptionSession | null>(null);
  const whisperRef = useRef<WhisperCaptionSession | null>(null);
  const finalReceived = useRef<Promise<void> | null>(null);
  const resolveFinal = useRef<(() => void) | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Synchronous mirrors of state for use inside socket/recorder callbacks.
  const phaseRef = useRef<Phase>('connecting');
  const pausedRef = useRef(false);
  const connected = useRef(false);
  const intentionalClose = useRef(false);
  const reconnectingRef = useRef(false);
  // A dropped socket leaves a gap in the live transcript, so once it happens we
  // stop trusting the live transcript and finish via the fallback (full WAV).
  const reconnectedDuringTake = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const { data: challenge } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => api<Challenge>(`/challenges/${challengeId}`),
  });

  function showCaption(text: string) {
    setTranscript(text);
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  function buildHandlers(onReadyOnce?: () => void): LiveSocketHandlers {
    return {
      onReady: () => {
        connected.current = true;
        onReadyOnce?.();
      },
      onDelta: (d) => {
        setTranscript((prev) => prev + d.text);
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      onFinal: () => resolveFinal.current?.(),
      onError: () => void handleDrop(),
      onClose: () => void handleDrop(),
    };
  }

  /** Handle an unexpected socket error/close: reconnect during a take, else fall back. */
  async function handleDrop() {
    if (intentionalClose.current) {
      resolveFinal.current?.();
      return;
    }
    if (!connected.current) {
      setFallbackMode(true); // initial connection failed
      return;
    }
    if (reconnectingRef.current || phaseRef.current !== 'recording') return;

    reconnectingRef.current = true;
    reconnectedDuringTake.current = true;
    setReconnecting(true);

    for (let attempt = 1; attempt <= MAX_RECONNECTS; attempt++) {
      await new Promise((r) => setTimeout(r, 1200 * attempt));
      if (intentionalClose.current || phaseRef.current !== 'recording') break;
      try {
        const next = new LiveSocket();
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('timeout')), READY_TIMEOUT);
          next
            .connect(attemptId, buildHandlers(() => {
              clearTimeout(t);
              resolve();
            }))
            .catch(reject);
        });
        socketRef.current = next; // onAudioStream reads socketRef, so audio resumes
        reconnectingRef.current = false;
        setReconnecting(false);
        return;
      } catch {
        /* try again */
      }
    }
    // Reconnect exhausted: keep recording locally, finish via fallback.
    reconnectingRef.current = false;
    setReconnecting(false);
    setFallbackMode(true);
  }

  useEffect(() => {
    let cancelled = false;
    finalReceived.current = new Promise((resolve) => {
      resolveFinal.current = resolve;
    });

    async function beginGemini() {
      const socket = new LiveSocket();
      socketRef.current = socket;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('socket timeout')), READY_TIMEOUT);
        socket
          .connect(attemptId, buildHandlers(() => {
            clearTimeout(timer);
            resolve();
          }))
          .catch(reject);
      }).catch(() => setFallbackMode(true)); // recording continues without captions

      if (cancelled) return;
      await recorder.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 250,
        keepAwake: true,
        onAudioStream: async (event) => {
          if (!pausedRef.current && typeof event.data === 'string') {
            socketRef.current?.sendAudio(event.data);
          }
        },
      });
    }

    async function beginDevice() {
      const session = new DeviceCaptionSession();
      deviceRef.current = session;
      await session.start({
        onText: showCaption,
        onError: (detail) => {
          // The recognizer is also the recorder here; a fatal error ends the take.
          if (phaseRef.current === 'recording') {
            setErrorDetail(`Speech recognition failed: ${detail}`);
            setPhase('error');
          }
        },
      });
    }

    async function beginWhisper(withCaptions: boolean) {
      if (withCaptions) {
        const session = new WhisperCaptionSession();
        whisperRef.current = session;
        await session.start({
          onText: showCaption,
          onError: () => setFallbackMode(true), // keep recording; captions die quietly
        });
      } else {
        setFallbackMode(true); // whisper chosen but no model: record-only
      }
      if (cancelled) return;
      await recorder.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 250,
        keepAwake: true,
        onAudioStream: async (event) => {
          if (!pausedRef.current && typeof event.data === 'string') {
            whisperRef.current?.pushAudio(event.data);
          }
        },
      });
    }

    async function begin() {
      try {
        if (engine === 'gemini') await beginGemini();
        else if (engine === 'device') await beginDevice();
        else await beginWhisper(engine === 'whisper');
        if (!cancelled) setPhase('recording');
      } catch (e) {
        if (!cancelled) {
          setErrorDetail(e instanceof Error ? e.message : 'failed to start');
          setPhase('error');
        }
      }
    }
    begin();

    return () => {
      cancelled = true;
      intentionalClose.current = true;
      socketRef.current?.close();
      deviceRef.current?.dispose();
      whisperRef.current?.stop().catch(() => {});
      if (engine !== 'device') recorder.stopRecording().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // The device engine has no audio-studio recorder to provide a clock.
  useEffect(() => {
    if (engine !== 'device' || phase !== 'recording') return;
    const startedAt = Date.now() - deviceSeconds * 1000;
    const t = setInterval(() => setDeviceSeconds((Date.now() - startedAt) / 1000), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, phase]);

  async function togglePause() {
    if (paused) {
      await recorder.resumeRecording();
      pausedRef.current = false;
      setPaused(false);
    } else {
      await recorder.pauseRecording();
      pausedRef.current = true;
      setPaused(true);
    }
  }

  async function stop() {
    setPhase('finishing');
    intentionalClose.current = true;
    try {
      if (engine === 'device') {
        const session = deviceRef.current;
        const { wavUri, durationSeconds } = session
          ? await session.stop()
          : { wavUri: null, durationSeconds: 0 };
        if (!wavUri) throw new Error('No recording was captured');
        const storagePath = await uploadRecording(wavUri, attemptId);
        await api(`/attempts/${attemptId}/transcribe-fallback`, {
          method: 'POST',
          body: JSON.stringify({
            duration_seconds: durationSeconds,
            storage_path: storagePath,
            size_bytes: null,
          }),
        });
        router.replace({ pathname: '/results/[attemptId]', params: { attemptId, challengeId } });
        return;
      }

      const socket = socketRef.current;
      // Only trust the live transcript if the socket held for the whole take.
      const liveWorked =
        engine === 'gemini' && !!socket?.isOpen && !fallbackMode && !reconnectedDuringTake.current;

      if (paused) await recorder.resumeRecording().catch(() => {});
      const recording = await recorder.stopRecording();
      await whisperRef.current?.stop().catch(() => {});

      if (liveWorked && socket) {
        socket.stop();
        await Promise.race([finalReceived.current, new Promise((r) => setTimeout(r, 20000))]);
      }
      socket?.close();

      const durationSeconds = (recording?.durationMs ?? 0) / 1000;
      let storagePath: string | null = null;
      if (recording?.fileUri) {
        try {
          storagePath = await uploadRecording(recording.fileUri, attemptId);
        } catch {
          if (!liveWorked) throw new Error('Upload failed — cannot transcribe');
        }
      }

      const endpoint = liveWorked
        ? `/attempts/${attemptId}/complete`
        : `/attempts/${attemptId}/transcribe-fallback`;
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          duration_seconds: durationSeconds,
          storage_path: storagePath,
          size_bytes: recording?.size ?? null,
        }),
      });

      router.replace({ pathname: '/results/[attemptId]', params: { attemptId, challengeId } });
    } catch (e) {
      setErrorDetail(e instanceof Error ? e.message : 'failed to finish');
      setPhase('error');
    }
  }

  const seconds =
    engine === 'device' ? Math.floor(deviceSeconds) : Math.floor(recorder.durationMs / 1000);
  const limit = challenge?.max_speak_seconds ?? 120;

  useEffect(() => {
    if (phase === 'recording' && !paused && seconds >= limit) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, paused, limit]);

  const live = phase === 'recording' && !paused;

  return (
    <View style={styles.container}>
      <Text style={styles.prompt} numberOfLines={3}>
        {challenge?.prompt ?? ''}
      </Text>

      <View style={styles.timerRow}>
        <View style={[styles.dot, live && styles.dotLive, paused && styles.dotPaused]} />
        <Text style={styles.timer}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </Text>
        <Text style={styles.limit}>
          / {Math.floor(limit / 60)}:{String(limit % 60).padStart(2, '0')}
        </Text>
        {paused && <Text style={styles.pausedTag}>PAUSED</Text>}
      </View>

      {reconnecting && (
        <View style={styles.reconnectBanner}>
          <Text style={styles.reconnectText}>Connection dropped — reconnecting…</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.transcriptBox}
        contentContainerStyle={{ padding: spacing.md }}>
        {fallbackMode && !transcript ? (
          <Text style={styles.fallbackNote}>
            {engine === 'offline'
              ? 'Whisper model not downloaded (Profile → AI settings) — your recording will be transcribed after you stop.'
              : 'Live captions unavailable — your recording will be transcribed after you stop.'}
          </Text>
        ) : transcript ? (
          <Text style={styles.transcript}>{transcript}</Text>
        ) : (
          <Text style={styles.fallbackNote}>
            {phase === 'connecting' ? 'Connecting…' : 'Start speaking — your words appear here.'}
          </Text>
        )}
      </ScrollView>

      {phase === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{errorDetail}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.errorAction}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.controls}>
          {engine !== 'device' && (
            <Pressable
              style={[styles.pauseButton, phase !== 'recording' && { opacity: 0.4 }]}
              disabled={phase !== 'recording'}
              onPress={togglePause}>
              <Text style={styles.pauseLabel}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.stopButton, phase !== 'recording' && { opacity: 0.5 }]}
            disabled={phase !== 'recording'}
            onPress={stop}>
            {phase === 'finishing' ? (
              <Text style={styles.stopLabel}>Finishing…</Text>
            ) : (
              <>
                <View style={styles.stopSquare} />
                <Text style={styles.stopLabel}>Stop</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: spacing.lg, paddingTop: 70, gap: spacing.md },
  prompt: { color: c.textSecondary, fontSize: 15, lineHeight: 21 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.border },
  dotLive: { backgroundColor: c.danger },
  dotPaused: { backgroundColor: c.textSecondary },
  timer: { fontSize: 34, fontWeight: '800', color: c.textPrimary, fontVariant: ['tabular-nums'] },
  limit: { fontSize: 16, color: c.textSecondary },
  pausedTag: { fontSize: 12, fontWeight: '700', color: c.primary, marginLeft: 'auto' },
  reconnectBanner: {
    backgroundColor: c.primaryMuted,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  reconnectText: { color: c.primary, fontSize: 13, fontWeight: '600' },
  transcriptBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
  },
  transcript: { color: c.textPrimary, fontSize: 17, lineHeight: 26 },
  fallbackNote: { color: c.textSecondary, fontSize: 15, fontStyle: 'italic' },
  controls: { flexDirection: 'row', gap: spacing.sm },
  pauseButton: {
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  pauseLabel: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
  stopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.danger,
    borderRadius: 14,
    paddingVertical: 16,
  },
  stopSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: '#fff' },
  stopLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
  errorBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  error: { color: c.danger, textAlign: 'center' },
  errorAction: { color: c.primary, fontWeight: '600' },
});
}
