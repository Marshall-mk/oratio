import { useAudioPlayer } from 'expo-audio';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ScoreCard } from '@/components/ScoreCard';
import { useRetryAttempt } from '@/hooks/useStartSession';
import { api } from '@/lib/api';
import { getPlaybackUrl } from '@/lib/recordings';
import { colors, spacing } from '@/theme';

interface StageScore {
  stage: string;
  score: number;
  dimensions: { dimension: string; score: number; rationale: string }[];
  summary: string | null;
}

interface AttemptDetail {
  id: string;
  session_id: string;
  attempt_number: number;
  status: string;
  duration_seconds: number | null;
  transcription_mode: string;
  transcript: { full_text: string; word_count: number | null; source: string } | null;
  scores: StageScore[];
  report: {
    overall_score: number;
    diagnosis: string;
    strengths: string[];
    weaknesses: string[];
    best_sentence: { text: string; reason: string } | null;
    worst_sentence: { text: string; reason: string } | null;
    suggested_rewrite: string | null;
    retry_challenge: string | null;
    detections: string[];
  } | null;
  audio_storage_path: string | null;
  previous_scores: StageScore[];
}

const STAGE_ORDER = ['thought', 'structure', 'delivery', 'social'];

export default function ResultsScreen() {
  const { attemptId, challengeId } = useLocalSearchParams<{
    attemptId: string;
    challengeId?: string;
  }>();
  const router = useRouter();
  const retry = useRetryAttempt();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const player = useAudioPlayer(playbackUrl ?? undefined);

  const { data: attempt, refetch } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api<AttemptDetail>(`/attempts/${attemptId}`),
    refetchInterval: (q) =>
      q.state.data && ['complete', 'failed'].includes(q.state.data.status) ? false : 2000,
  });

  useEffect(() => {
    if (attempt?.audio_storage_path) {
      getPlaybackUrl(attempt.audio_storage_path).then(setPlaybackUrl).catch(() => {});
    }
  }, [attempt?.audio_storage_path]);

  const evaluating = attempt && !['complete', 'failed'].includes(attempt.status);
  const report = attempt?.report;
  const orderedScores = STAGE_ORDER.map((s) => attempt?.scores.find((x) => x.stage === s)).filter(
    Boolean,
  ) as StageScore[];
  const prevByStage = Object.fromEntries(
    (attempt?.previous_scores ?? []).map((s) => [s.stage, s.score]),
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.dismissTo('/')}>
        <Text style={styles.back}>‹ Home</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Attempt #{attempt?.attempt_number ?? '…'}</Text>
        {report && (
          <Text style={styles.overall}>
            {report.overall_score.toFixed(1)}
            <Text style={styles.overallMax}> / 10</Text>
          </Text>
        )}
      </View>
      <Text style={styles.meta}>
        {attempt
          ? `${Math.round(attempt.duration_seconds ?? 0)}s · ${attempt.transcript?.word_count ?? 0} words`
          : ' '}
      </Text>

      {evaluating && (
        <View style={styles.evaluatingBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.evaluatingText}>Evaluating your thinking, structure, and delivery…</Text>
        </View>
      )}

      {attempt?.status === 'failed' && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Evaluation failed — this is usually transient.</Text>
          <Button
            title="Re-run evaluation"
            onPress={async () => {
              await api(`/attempts/${attemptId}/reevaluate`, { method: 'POST' });
              refetch();
            }}
          />
        </View>
      )}

      {report && (
        <View style={styles.diagnosisCard}>
          <Text style={styles.diagnosisLabel}>Diagnosis</Text>
          <Text style={styles.diagnosis}>{report.diagnosis}</Text>
          {report.detections.length > 0 && (
            <View style={styles.detections}>
              {report.detections.map((d) => (
                <View key={d} style={styles.detectionPill}>
                  <Text style={styles.detectionText}>{d.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {orderedScores.map((s) => (
        <ScoreCard
          key={s.stage}
          stage={s.stage}
          score={s.score}
          summary={s.summary}
          dimensions={s.dimensions}
          previousScore={prevByStage[s.stage]}
        />
      ))}

      {report && (
        <>
          <View style={styles.twoCol}>
            <View style={[styles.listCard, { flex: 1 }]}>
              <Text style={[styles.listTitle, { color: colors.success }]}>Strengths</Text>
              {report.strengths.map((s, i) => (
                <Text key={i} style={styles.listItem}>• {s}</Text>
              ))}
            </View>
            <View style={[styles.listCard, { flex: 1 }]}>
              <Text style={[styles.listTitle, { color: colors.danger }]}>Weaknesses</Text>
              {report.weaknesses.map((w, i) => (
                <Text key={i} style={styles.listItem}>• {w}</Text>
              ))}
            </View>
          </View>

          {report.best_sentence && (
            <View style={styles.sentenceCard}>
              <Text style={[styles.listTitle, { color: colors.success }]}>Best sentence</Text>
              <Text style={styles.sentenceQuote}>“{report.best_sentence.text}”</Text>
              <Text style={styles.sentenceReason}>{report.best_sentence.reason}</Text>
            </View>
          )}
          {report.worst_sentence && (
            <View style={styles.sentenceCard}>
              <Text style={[styles.listTitle, { color: colors.danger }]}>Weakest sentence</Text>
              <Text style={styles.sentenceQuote}>“{report.worst_sentence.text}”</Text>
              <Text style={styles.sentenceReason}>{report.worst_sentence.reason}</Text>
            </View>
          )}

          {report.suggested_rewrite && (
            <View style={styles.sentenceCard}>
              <Text style={[styles.listTitle, { color: colors.accent }]}>Suggested rewrite</Text>
              <Text style={styles.sentenceQuote}>{report.suggested_rewrite}</Text>
            </View>
          )}

          {report.retry_challenge && (
            <View style={styles.retryCard}>
              <Text style={styles.retryLabel}>Your next move</Text>
              <Text style={styles.retryText}>{report.retry_challenge}</Text>
              <Button
                title="Retry challenge"
                loading={retry.isPending}
                onPress={() =>
                  attempt &&
                  challengeId &&
                  retry.mutate({
                    sessionId: attempt.session_id,
                    challengeId,
                    mode: attempt.scores.some((s) => s.stage === 'social')
                      ? 'roleplay'
                      : 'monologue',
                  })
                }
              />
            </View>
          )}
        </>
      )}

      {playbackUrl && (
        <Button
          title={player.playing ? 'Pause recording' : 'Play your recording'}
          variant="ghost"
          onPress={() => (player.playing ? player.pause() : player.play())}
        />
      )}

      {attempt?.transcript && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Transcript</Text>
          <Text style={styles.transcript}>{attempt.transcript.full_text}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 60, gap: spacing.md },
  back: { color: colors.textDim, fontSize: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  overall: { fontSize: 30, fontWeight: '800', color: colors.accent },
  overallMax: { fontSize: 15, color: colors.textDim, fontWeight: '600' },
  meta: { fontSize: 14, color: colors.textDim },
  evaluatingBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  evaluatingText: { color: colors.textDim, fontSize: 14 },
  banner: { backgroundColor: colors.accentSoft, borderRadius: 12, padding: spacing.md },
  bannerText: { color: colors.text, fontSize: 14 },
  diagnosisCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  diagnosisLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  diagnosis: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  detections: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detectionPill: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detectionText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  listCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: 6,
  },
  listTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  listItem: { color: colors.text, fontSize: 13, lineHeight: 19 },
  sentenceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sentenceQuote: { color: colors.text, fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  sentenceReason: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  retryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  retryLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  retryText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardLabel: { color: colors.textDim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  transcript: { color: colors.text, fontSize: 15, lineHeight: 23 },
});
