import { verdictStyles, type Verdict } from '@/lib/verdict';

interface VerdictBadgeProps {
  verdict: Verdict;
}

/** Compact colored pill showing a check-in's verdict in history / place pages. */
export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const style = verdictStyles[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
    >
      <span className="font-semibold">{style.label}</span>
      <span className="opacity-80">· {style.meaning}</span>
    </span>
  );
}
