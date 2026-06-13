import { useAudioPlayer } from 'expo-audio';
import { useAudioRecorder } from '@siteed/audio-studio';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { writeWavBase64 } from '@/lib/audioFile';
import { RoleplaySocket } from '@/lib/roleplaySocket';
import { useColors, type AppColors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

type Turn = { role: 'user' | 'persona'; text: string };
type Phase = 'connecting' | 'persona_speaking' | 'your_turn' | 'speaking' | 'ending' | 'error';

export default function RoleplayScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const { attemptId, challengeId } = useLocalSearchParams<{
    attemptId: string;
    challengeId: string;
  }>();
  const router = useRouter();
  const recorder = useAudioRecorder();
  const player = useAudioPlayer();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [liveUser, setLiveUser] = useState('');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<RoleplaySocket | null>(null);
  const turnActive = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const audioCounter = useRef(0);

  const { data: challenge } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => api<Challenge>(`/challenges/${challengeId}`),
  });

  useEffect(() => {
    const socket = new RoleplaySocket();
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
            if (turnActive.current && typeof event.data === 'string') {
              socket.sendAudio(event.data);
            }
          },
        });
        await socket.connect(attemptId, {
          onReady: () => mounted && setPhase('persona_speaking'),
          onUserDelta: (text) => setLiveUser((p) => p + text),
          onPersonaDelta: () => {},
          onPersonaTurn: (text, audio) => {
            setTurns((prev) => [...prev, { role: 'persona', text }]);
            setPhase('your_turn');
            scrollRef.current?.scrollToEnd({ animated: true });
            if (audio) {
              try {
                const uri = writeWavBase64(audio, `t${audioCounter.current++}`);
                player.replace({ uri });
                player.play();
              } catch {
                /* playback is best-effort */
              }
            }
          },
          onSaved: () => {
            router.replace({ pathname: '/results/[attemptId]', params: { attemptId, challengeId } });
          },
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

  function startSpeaking() {
    setLiveUser('');
    turnActive.current = true;
    socketRef.current?.startUserTurn();
    setPhase('speaking');
  }

  function doneSpeaking() {
    turnActive.current = false;
    socketRef.current?.endUserTurn();
    if (liveUser.trim()) setTurns((prev) => [...prev, { role: 'user', text: liveUser.trim() }]);
    setLiveUser('');
    setPhase('persona_speaking');
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  function endConversation() {
    setPhase('ending');
    socketRef.current?.endConversation();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.persona}>{challenge?.persona_name ?? 'Scenario'}</Text>
        <Pressable onPress={endConversation} disabled={turns.length < 2}>
          <Text style={[styles.end, turns.length < 2 && { opacity: 0.4 }]}>End & evaluate</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent}>
        {turns.map((t, i) => (
          <View
            key={i}
            style={[styles.bubble, t.role === 'user' ? styles.userBubble : styles.personaBubble]}>
            <Text style={styles.bubbleText}>{t.text}</Text>
          </View>
        ))}
        {liveUser ? (
          <View style={[styles.bubble, styles.userBubble, { opacity: 0.7 }]}>
            <Text style={styles.bubbleText}>{liveUser}</Text>
          </View>
        ) : null}
        {phase === 'persona_speaking' && (
          <Text style={styles.status}>{challenge?.persona_name ?? 'They'} is responding…</Text>
        )}
      </ScrollView>

      {phase === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.errorAction}>Go back</Text>
          </Pressable>
        </View>
      ) : phase === 'speaking' ? (
        <Pressable style={[styles.micButton, styles.micActive]} onPress={doneSpeaking}>
          <View style={styles.stopSquare} />
          <Text style={styles.micLabel}>Done speaking</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.micButton, phase !== 'your_turn' && { opacity: 0.4 }]}
          disabled={phase !== 'your_turn'}
          onPress={startSpeaking}>
          <Text style={styles.micLabel}>
            {phase === 'connecting'
              ? 'Connecting…'
              : phase === 'ending'
                ? 'Evaluating…'
                : 'Hold the floor — tap to speak'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: spacing.lg, paddingTop: 70, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  persona: { fontSize: 20, fontWeight: '800', color: c.textPrimary },
  end: { color: c.primary, fontSize: 14, fontWeight: '700' },
  thread: { flex: 1 },
  threadContent: { gap: spacing.sm, paddingVertical: spacing.sm },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: spacing.md },
  personaBubble: { backgroundColor: c.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: c.primaryMuted, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText: { color: c.textPrimary, fontSize: 15, lineHeight: 22 },
  status: { color: c.textSecondary, fontSize: 13, fontStyle: 'italic', alignSelf: 'flex-start', marginTop: 4 },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  micActive: { backgroundColor: c.danger },
  stopSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: '#fff' },
  micLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  errorText: { color: c.danger, textAlign: 'center' },
  errorAction: { color: c.primary, fontWeight: '600' },
});
}
