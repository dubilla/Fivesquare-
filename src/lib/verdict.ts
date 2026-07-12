// Single source of truth for verdict values, kept free of DB imports so it can
// be used from client components without pulling Drizzle into the bundle.
// The Drizzle enum (src/lib/db/schema.ts) is derived from this.
export const VERDICTS = ['yes', 'maybe', 'no'] as const;

export type Verdict = (typeof VERDICTS)[number];

export function isVerdict(value: unknown): value is Verdict {
  return (
    typeof value === 'string' && (VERDICTS as readonly string[]).includes(value)
  );
}

interface VerdictStyle {
  /** Short label used on the segmented control and badge. */
  label: string;
  /** Sentence-shaped meaning shown alongside the badge. */
  meaning: string;
  /** Classes for the badge pill. */
  badge: string;
  /** Classes for the segmented control button when selected. */
  selected: string;
}

// Green / amber / red — the verdict is decision-shaped on purpose (S2).
export const verdictStyles: Record<Verdict, VerdictStyle> = {
  yes: {
    label: 'Yes',
    meaning: 'Order again',
    badge:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    selected: 'bg-green-600 text-white border-green-600 shadow-sm',
  },
  maybe: {
    label: 'Maybe',
    meaning: 'On the fence',
    badge:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    selected: 'bg-amber-500 text-white border-amber-500 shadow-sm',
  },
  no: {
    label: 'No',
    meaning: "Wouldn't reorder",
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    selected: 'bg-red-600 text-white border-red-600 shadow-sm',
  },
};
