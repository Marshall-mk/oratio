// React Native's `global` for libraries whose source (resolved via the
// "react-native" exports condition, e.g. whisper.rn) references it directly.
declare var global: typeof globalThis & Record<string, any>;
