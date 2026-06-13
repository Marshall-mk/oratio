export const colors = {
  bg: '#0E0F12',
  card: '#16181D',
  cardElevated: '#1E2128',
  border: '#2A2D34',
  text: '#F2F3F5',
  textDim: '#9BA1AC',
  textFaint: '#6B7280',
  accent: '#7C5CFF',
  accentSoft: '#241F45',
  danger: '#FF6B6B',
  warning: '#E8B931',
  success: '#3DDC97',
  track: '#24272E',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** Color for a 1–10 score. */
export function scoreColor(score: number): string {
  if (score >= 7.5) return colors.success;
  if (score >= 5) return colors.warning;
  return colors.danger;
}
