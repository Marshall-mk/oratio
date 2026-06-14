import { useAudioRecorder } from '@siteed/audio-studio';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { DebateSocket } from '@/lib/debateSocket';
import { useColors, type AppColors, radius, scoreColor, spacing } from '@/theme';
import type { Debate } from '@/types/debate';

interface Turn {
  participant: string;
  round: number;
  label: string;
}

function buildTurns(d: Debate): Turn[] {
  if (d.format === 'rebuttal') {
    return [
      ...d.participants.map((p) => ({ participant: p.name, round: 1, label: 'Opening' })),
      ...d.participants.map((p) => ({ participant: p.name, round: 2, label: 'Rebuttal' })),
    ];
  }
  return d.participants.map((p) => ({ participant: p.name, round: 1, label: p.side ?? 'Argument' }));
}

type Phase = 'ready' | 'recording' | 'reveal' | 'result';

export default function DebatePlay() {
  const c = useColors();
  const styles = makeStyles(c);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recorder = useAudioRecorder();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [liveText, setLiveText] = useState('');
  const socketRef = useRef<DebateSocket | null>(null);

  const { data: debate } = useQuery({
    queryKey: ['debate', id],
    queryFn: () => api<Debate>(`/debates/${id}`),
  });

  const rank = useMutation({
    mutationFn: () => api<Debate>(`/debates/${id}/rank`, { method: 'POST' }),
    onSuccess: (d) => {
      queryResult.current = d;
      setPhase('result');
    },
  });
  const queryResult = useRef<Debate | null>(null);

  const turns = useMemo(() => (debate ? buildTurns(debate) : []), [debate]);
  const current = turns[index];
  const result = queryResult.current?.result ?? debate?.result ?? null;

  async function startTurn() {
    if (!current) return;
    setLiveText('');
    setPhase('recording');
    const socket = new DebateSocket();
    socketRef.current = socket;
    try {
      await recorder.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 250,
        keepAwake: true,
        onAudioStream: async (e) => {
          if (typeof e.data === 'string') socketRef.current?.sendAudio(e.data);
        },
      });
      await socket.connect(id, current.participant, current.round, {
        onReady: () => {},
        onDelta: (t) => setLiveText((p) => p + t),
        onSaved: () => {
          socket.close();
          const next = index + 1;
          setIndex(next);
          setPhase(next >= turns.length ? 'reveal' : 'ready');
        },
        onError: () => {},
        onClose: () => {},
      });
    } catch {
      setPhase('ready');
    }
  }

  async function doneTurn() {
    await recorder.stopRecording().catch(() => {});
    socketRef.current?.stop();
  }

  if (!debate) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  // ---- Results ----
  if (phase === 'result' && result) {
    const ranked = [...result.rankings].sort((a, b) => a.rank - b.rank);
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Winner</Text>
        <Text style={styles.winner}>🏆 {result.winner}</Text>
        {result.winning_side && <Text style={styles.side}>Winning side: {result.winning_side}</Text>}
        <Text style={styles.rationale}>{result.rationale}</Text>

        <Text style={styles.motionSmall}>{debate.motion}</Text>

        {ranked.map((r) => (
          <View key={r.name} style={styles.rankRow}>
            <Text style={styles.rankNum}>{r.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankName}>{r.name}</Text>
              <Text style={styles.rankCritique}>{r.critique}</Text>
            </View>
            <Text style={[styles.rankScore, { color: scoreColor(c, r.score) }]}>{r.score.toFixed(1)}</Text>
          </View>
        ))}

        <View style={{ height: spacing.md }} />
        <Button title="New debate" onPress={() => router.replace('/debate')} />
        <Button title="Back to Gym" variant="ghost" onPress={() => router.dismissTo('/gym')} />
      </ScrollView>
    );
  }

  // ---- Reveal ----
  if (phase === 'reveal') {
    return (
      <View style={styles.center}>
        <Text style={styles.kicker}>All speakers done</Text>
        <Text style={styles.title}>Ready for the verdict?</Text>
        <Text style={styles.motionSmall}>{debate.motion}</Text>
        <View style={{ height: spacing.md }} />
        <Button
          title={rank.isPending ? 'Judging…' : 'Reveal winner'}
          loading={rank.isPending}
          onPress={() => rank.mutate()}
        />
      </View>
    );
  }

  // ---- Turn play ----
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {phase !== 'recording' && <BackButton label="Quit" onPress={() => router.dismissTo('/gym')} />}
        <Text style={styles.kicker}>Motion</Text>
        <Text style={styles.motion}>{debate.motion}</Text>

        <View style={styles.progressRow}>
          {turns.map((t, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < index && styles.dotDone,
                i === index && styles.dotCurrent,
              ]}
            />
          ))}
        </View>

        <View style={styles.turnCard}>
          <Text style={styles.turnWho}>{current?.participant}</Text>
          <Text style={styles.turnLabel}>{current?.label}{debate.format === 'rebuttal' ? '' : "'s turn"}</Text>
        </View>

        {phase === 'recording' && (
          <View style={styles.captionBox}>
            <Text style={styles.caption}>{liveText || 'Listening…'}</Text>
          </View>
        )}
      </ScrollView>

      {phase === 'recording' ? (
        <Pressable style={styles.stopButton} onPress={doneTurn}>
          <View style={styles.stopSquare} />
          <Text style={styles.stopLabel}>Done</Text>
        </Pressable>
      ) : (
        <Button title={`Start ${current?.participant ?? ''}'s turn`} onPress={startTurn} />
      )}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, padding: spacing.lg, gap: spacing.sm },
    container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.md },
    kicker: { fontSize: 12, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1 },
    motion: { fontSize: 22, fontWeight: '800', color: c.textPrimary, lineHeight: 30 },
    motionSmall: { fontSize: 14, color: c.textSecondary, fontStyle: 'italic', textAlign: 'center' },
    title: { fontSize: 26, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
    progressRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.border },
    dotDone: { backgroundColor: c.primary },
    dotCurrent: { backgroundColor: c.primary, transform: [{ scale: 1.3 }] },
    turnCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.md,
    },
    turnWho: { fontSize: 30, fontWeight: '900', color: c.textPrimary },
    turnLabel: { fontSize: 15, color: c.textSecondary },
    captionBox: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, minHeight: 120 },
    caption: { color: c.textPrimary, fontSize: 16, lineHeight: 24 },
    stopButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      backgroundColor: c.danger, borderRadius: 14, paddingVertical: 16, margin: spacing.lg,
    },
    stopSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: '#fff' },
    stopLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
    winner: { fontSize: 34, fontWeight: '900', color: c.textPrimary },
    side: { fontSize: 14, color: c.primary, fontWeight: '700' },
    rationale: { fontSize: 15, color: c.textSecondary, lineHeight: 22, marginBottom: spacing.sm },
    rankRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md,
    },
    rankNum: { fontSize: 20, fontWeight: '900', color: c.textMuted, width: 24, textAlign: 'center' },
    rankName: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    rankCritique: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    rankScore: { fontSize: 20, fontWeight: '800' },
  });
}
