// lib/debounce.ts

/**
 * Trailing debounce: calling `trigger()` schedules one invocation of `fn` after
 * `waitMs`; repeated triggers within the window collapse into that single call.
 * Used to coalesce bursts of realtime pings into one re-fetch.
 */
export function createTrailingDebounce(fn: () => void, waitMs: number): {
  trigger: () => void;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, waitMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
