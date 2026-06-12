import { useAudioRecorder } from '@siteed/audio-studio';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { LiveSocket } from '@/lib/liveSocket';
import { uploadRecording } from '@/lib/recordings';
import { colors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

type Phase = 'connecting' | 'recording' | 'finishing' | 'error';

export default function SessionScreen() {
  const { attemptId, challengeId } = useLocalSearchParams<{
    attemptId: string;
    challengeId: string;
  }>();
  const router = useRouter();
  const recorder = useAudioRecorder();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [transcript, setTranscript] = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const socketRef = useRef<LiveSocket | null>(null);
  const finalReceived = useRef<Promise<void> | null>(null);
  const resolveFinal = useRef<(() => void) | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { data: challenge } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => api<Challenge>(`/challenges/${challengeId}`),
  });

  useEffect(() => {
    let cancelled = false;
    const socket = new LiveSocket();
    socketRef.current = socket;
    finalReceived.current = new Promise((resolve) => {
      resolveFinal.current = resolve;
    });

    async function begin() {
      try {
        // Connect the live pipeline first so no audio is dropped.
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('socket timeout')), 8000);
          socket
            .connect(attemptId, {
              onReady: () => {
                clearTimeout(timer);
                resolve();
              },
              onDelta: (d) => {
                setTranscript((prev) => prev + d.text);
                scrollRef.current?.scrollToEnd({ animated: true });
              },
              onFinal: () => resolveFinal.current?.(),
              onError: () => {
                clearTimeout(timer);
                setFallbackMode(true);
                reject(new Error('live socket failed'));
              },
              onClose: () => resolveFinal.current?.(),
            })
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
            if (typeof event.data === 'string') socket.sendAudio(event.data);
          },
        });
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
      socket.close();
      recorder.stopRecording().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function stop() {
    setPhase('finishing');
    try {
      const socket = socketRef.current;
      const liveWorked = socket?.isOpen && !fallbackMode;

      const recording = await recorder.stopRecording();
      if (liveWorked && socket) {
        socket.stop();
        // Wait for the server to finalize + persist the transcript (or close).
        await Promise.race([
          finalReceived.current,
          new Promise((r) => setTimeout(r, 20000)),
        ]);
        socket.close();
      }

      const durationSeconds = (recording?.durationMs ?? 0) / 1000;
      let storagePath: string | null = null;
      if (recording?.fileUri) {
        try {
          storagePath = await uploadRecording(recording.fileUri, attemptId);
        } catch {
          // Playback is a nice-to-have on the live path; required for fallback.
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

      router.replace({
        pathname: '/results/[attemptId]',
        params: { attemptId, challengeId },
      });
    } catch (e) {
      setErrorDetail(e instanceof Error ? e.message : 'failed to finish');
      setPhase('error');
    }
  }

  const seconds = Math.floor(recorder.durationMs / 1000);
  const limit = challenge?.max_speak_seconds ?? 120;

  useEffect(() => {
    if (phase === 'recording' && seconds >= limit) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, limit]);

  return (
    <View style={styles.container}>
      <Text style={styles.prompt} numberOfLines={3}>
        {challenge?.prompt ?? ''}
      </Text>

      <View style={styles.timerRow}>
        <View style={[styles.dot, phase === 'recording' && styles.dotLive]} />
        <Text style={styles.timer}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </Text>
        <Text style={styles.limit}>/ {Math.floor(limit / 60)}:{String(limit % 60).padStart(2, '0')}</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.transcriptBox} contentContainerStyle={{ padding: spacing.md }}>
        {fallbackMode ? (
          <Text style={styles.fallbackNote}>
            Live captions unavailable — your recording will be transcribed after you stop.
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 70, gap: spacing.md },
  prompt: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotLive: { backgroundColor: colors.danger },
  timer: { fontSize: 34, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  limit: { fontSize: 16, color: colors.textDim },
  transcriptBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  transcript: { color: colors.text, fontSize: 17, lineHeight: 26 },
  fallbackNote: { color: colors.textDim, fontSize: 15, fontStyle: 'italic' },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 16,
  },
  stopSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: '#fff' },
  stopLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
  errorBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
  errorAction: { color: colors.accent, fontWeight: '600' },
});
