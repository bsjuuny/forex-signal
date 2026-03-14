export const SIGNAL_COLORS = {
  BUY: {
    bg: 'bg-rose-950/60',
    border: 'border-rose-500',
    badge: 'bg-rose-500 text-white',
    text: 'text-rose-400',
    detailBg: 'bg-rose-500/10 border-rose-500/30',
    label: '매수',
  },
  SELL: {
    bg: 'bg-blue-950/60',
    border: 'border-blue-500',
    badge: 'bg-blue-500 text-white',
    text: 'text-blue-400',
    detailBg: 'bg-blue-500/10 border-blue-500/30',
    label: '매도',
  },
  NEUTRAL: {
    bg: 'bg-zinc-900/60',
    border: 'border-zinc-600',
    badge: 'bg-zinc-600 text-white',
    text: 'text-zinc-400',
    detailBg: 'bg-zinc-700/30 border-zinc-600/30',
    label: '중립',
  },
} as const;

export type SignalType = keyof typeof SIGNAL_COLORS;
