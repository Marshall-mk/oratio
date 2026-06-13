import { useAudioRecorder } from '@siteed/audio-studio';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { CoachSocket, type CoachSummary, type Meters } from '@/lib/coachSocket';
import { colors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

type Phase = 'connecting' | 'coaching' | 'finishing' | 'error';

const NUDGE_COLORS: Record<string, string> = {
  pace: '#E8B931',
  filler: '#FF7AB6',
  ramble: '#4FB8FF',
};

function meterColor(v: number): string {
  if (v >= 75) return colors.success;
  if (v >= 50) return '#E8B931';
  return colors.danger;
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meter}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={[styles.meterValue, { color: meterColor(value) }]}>{value}</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${value}%`, backgroundColor: meterColor(value) }]} />
      </View>
    </View>
  );
}

export default function CoachScreen() {
  const { attemptId, challengeId } = useLocalSearchParams<{
    attemptId: string;
    challengeId: string;
  }>();
  const router = useRouter();
  const recorder = useAudioRecorder();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [transcript, setTranscript] = useState('');
  const [meters, setMeters] = useState<Meters>({ pacing: 70, clarity: 100, confidence: 80, wpm: null });
  const [nudge, setNudge] = useState<{ kind: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<CoachSocket | null>(null);
  const summaryRef = useRef<CoachSummary | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { data: challenge } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => api<Challenge>(`/challenges/${challengeId}`),
  });

  useEffect(() => {
    const socket = new CoachSocket();
    socketRef.current = socket;
    let mounted = true;

    async function begin() {
      try {
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
        await socket.connect(attemptId, {
          onReady: () => mounted && setPhase('coaching'),
          onDelta: (text) => {
            setTranscript((p) => p + text);
            scrollRef.current?.scrollToEnd({ animated: true });
          },
          onNudge: (kind, text) => {
            setNudge({ kind, text });
            if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
            nudgeTimer.current = setTimeout(() => setNudge(null), 4000);
          },
          onMeters: (m) => setMeters(m),
          onSummary: (s) => (summaryRef.current = s),
          onError: (detail) => {
            if (mounted) {
              setError(detail);
              setPhase('error');
            }
          },
          onClose: () => {},
        });
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'failed to start');
          setPhase('error');
        }
      }
    }
    begin();

    return () => {
      mounted = false;
      socket.close();
      recorder.stopRecording().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function stop() {
    setPhase('finishing');
    socketRef.current?.stop();
    await recorder.stopRecording().catch(() => {});
    // Give the server a moment to send coach_summary + persist the transcript.
    setTimeout(
      () => router.replace({ pathname: '/results/[attemptId]', params: { attemptId, challengeId } }),
      1500,
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.mode}>{challenge?.title ?? 'Live Coach'}</Text>

      <View style={styles.meters}>
        <Meter label="Pacing" value={meters.pacing} />
        <Meter label="Clarity" value={meters.clarity} />
        <Meter label="Confidence" value={meters.confidence} />
      </View>
      {meters.wpm != null && <Text style={styles.wpm}>{meters.wpm} words/min</Text>}

      <View style={styles.nudgeSlot}>
        {nudge && (
          <View style={[styles.nudge, { borderColor: NUDGE_COLORS[nudge.kind] ?? colors.accent }]}>
            <Text style={[styles.nudgeText, { color: NUDGE_COLORS[nudge.kind] ?? colors.accent }]}>
              {nudge.text}
            </Text>
          </View>
        )}
      </View>

      <ScrollView ref={scrollRef} style={styles.transcriptBox} contentContainerStyle={{ padding: spacing.md }}>
        {transcript ? (
          <Text style={styles.transcript}>{transcript}</Text>
        ) : (
          <Text style={styles.hint}>
            {phase === 'connecting' ? 'Connecting…' : 'Start speaking — your coach is listening.'}
          </Text>
        )}
      </ScrollView>

      {phase === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.errorAction}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.stopButton, phase !== 'coaching' && { opacity: 0.5 }]}
          disabled={phase !== 'coaching'}
          onPress={stop}>
          <View style={styles.stopSquare} />
          <Text style={styles.stopLabel}>{phase === 'finishing' ? 'Finishing…' : 'Stop & get report'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 70, gap: spacing.md },
  mode: { fontSize: 20, fontWeight: '800', color: colors.text },
  meters: { gap: spacing.sm },
  meter: { gap: 4 },
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  meterValue: { fontSize: 13, fontWeight: '800' },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: colors.card },
  meterFill: { height: 8, borderRadius: 4 },
  wpm: { color: colors.textDim, fontSize: 12, textAlign: 'right' },
  nudgeSlot: { minHeight: 52, justifyContent: 'center' },
  nudge: { borderWidth: 1, borderRadius: 12, padding: spacing.md, backgroundColor: colors.card },
  nudgeText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  transcriptBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  transcript: { color: colors.text, fontSize: 16, lineHeight: 24 },
  hint: { color: colors.textDim, fontSize: 15, fontStyle: 'italic' },
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
