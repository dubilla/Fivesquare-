'use client';

import { useRef } from 'react';
import { VERDICTS, verdictStyles, type Verdict } from '@/lib/verdict';

interface VerdictControlProps {
  value: Verdict | null;
  onChange: (verdict: Verdict) => void;
  /** Accessible label for the radiogroup. */
  ariaLabel?: string;
}

/**
 * The most important input on the check-in form: "Would you order this again?"
 * A required, three-option segmented control, color-coded green/amber/red.
 *
 * Implements the ARIA radiogroup pattern: roving tabindex (one tab stop) and
 * arrow-key navigation that moves focus and selects, per WAI-ARIA.
 */
export function VerdictControl({
  value,
  onChange,
  ariaLabel = 'Would you order this again?',
}: VerdictControlProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % VERDICTS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + VERDICTS.length) % VERDICTS.length;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(VERDICTS[nextIndex]);
    buttonRefs.current[nextIndex]?.focus();
  };

  // Roving tabindex: the selected option is the single tab stop; if none is
  // selected yet, the first option holds it.
  const tabStopIndex = value ? VERDICTS.indexOf(value) : 0;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-2"
    >
      {VERDICTS.map((verdict, index) => {
        const style = verdictStyles[verdict];
        const isSelected = value === verdict;
        return (
          <button
            key={verdict}
            ref={el => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => onChange(verdict)}
            onKeyDown={e => handleKeyDown(e, index)}
            className={`flex flex-col items-center justify-center rounded-lg border py-3 px-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 ${
              isSelected
                ? style.selected
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-lg font-semibold">{style.label}</span>
            <span
              className={`text-xs ${isSelected ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {style.meaning}
            </span>
          </button>
        );
      })}
    </div>
  );
}
