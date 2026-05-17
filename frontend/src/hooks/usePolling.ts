import { useCallback, useRef } from "react";

interface PollingDecision {
  stop: boolean;
}

export const usePolling = <T>(
  fetcher: () => Promise<T>,
  onResult: (data: T) => Promise<PollingDecision> | PollingDecision,
  interval = 2000,
) => {
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    stop();

    const tick = async () => {
      const data = await fetcher();
      const decision = await onResult(data);

      if (!decision.stop) {
        timerRef.current = window.setTimeout(tick, interval);
      }
    };

    await tick();
  }, [fetcher, interval, onResult, stop]);

  return { start, stop };
};
