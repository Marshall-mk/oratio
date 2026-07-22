import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Live captions from the OS speech recognizer (Android SpeechRecognizer /
 * iOS SFSpeechRecognizer) via expo-speech-recognition.
 *
 * The recognizer owns the microphone for the whole take — @siteed/audio-studio
 * must NOT record at the same time (Android only feeds one capture client).
 * `recordingOptions.persist` makes the recognizer itself write the 16 kHz mono
 * WAV we upload for evaluation, so nothing is lost by skipping audio-studio.
 */
export interface DeviceCaptionHandlers {
  /** Full caption text so far (finalized segments + current interim). */
  onText: (text: string) => void;
  onError: (detail: string) => void;
}

export class DeviceCaptionSession {
  private subs: { remove: () => void }[] = [];
  private finalized = '';
  private wavUri: string | null = null;
  private ended: Promise<void> | null = null;
  private resolveEnded: (() => void) | null = null;
  private startedAt = 0;

  async start(handlers: DeviceCaptionHandlers): Promise<void> {
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) throw new Error('Speech recognition permission denied');

    this.ended = new Promise((resolve) => {
      this.resolveEnded = resolve;
    });

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event.results?.[0]?.transcript ?? '';
        if (event.isFinal) {
          this.finalized = this.finalized ? `${this.finalized} ${transcript}` : transcript;
          handlers.onText(this.finalized);
        } else {
          handlers.onText(this.finalized ? `${this.finalized} ${transcript}` : transcript);
        }
      }),
      // audiostart/audioend carry the persisted recording's file uri.
      ExpoSpeechRecognitionModule.addListener('audioend', (event) => {
        if (event?.uri) this.wavUri = event.uri;
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        // "no-speech" between phrases is routine in continuous mode; ignore.
        if (event.error !== 'no-speech') handlers.onError(event.message ?? event.error);
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        this.resolveEnded?.();
      }),
    );

    this.startedAt = Date.now();
    // Use the device's default recognition service. Pinning Google's package
    // breaks on devices without the Google app (e.g. some Samsung tablets
    // default to Samsung's recognizer and don't expose Google's service).
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      recordingOptions: {
        persist: true,
        outputSampleRate: 16000,
      },
    });
  }

  /** Stop recognition; resolves with the persisted WAV and elapsed time. */
  async stop(): Promise<{ wavUri: string | null; durationSeconds: number }> {
    const durationSeconds = (Date.now() - this.startedAt) / 1000;
    ExpoSpeechRecognitionModule.stop();
    // The 'end' event (and the audioend carrying the file uri) usually lands
    // well under a second after stop(); don't hang forever if it doesn't.
    await Promise.race([this.ended, new Promise((r) => setTimeout(r, 4000))]);
    this.dispose();
    return { wavUri: this.wavUri, durationSeconds };
  }

  dispose(): void {
    for (const s of this.subs) s.remove();
    this.subs = [];
  }
}
