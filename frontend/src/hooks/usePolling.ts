import { useRef, useCallback, useEffect } from 'react';

const POLL_INTERVAL = 5000;

/**
 * 通用轮询 Hook
 *
 * @param fetchFn   接收 id，返回数据的异步函数
 * @param onResult  处理数据，返回 { stop: true } 时停止轮询
 */
export function usePolling<T>(
  fetchFn: (id: number) => Promise<T>,
  onResult: (data: T) => { stop: boolean } | Promise<{ stop: boolean }>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activeIdRef.current = null;
  }, []);

  const start = useCallback((id: number) => {
    // 停止上一次轮询（换绘本时）
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activeIdRef.current = id;

    const tick = async () => {
      if (activeIdRef.current !== id) return;
      try {
        const data = await fetchFn(id);
        if (activeIdRef.current !== id) return;

        const { stop: shouldStop } = await onResult(data);
        if (!shouldStop && activeIdRef.current === id) {
          timerRef.current = setTimeout(tick, POLL_INTERVAL);
        }
      } catch {
        // 网络抖动时静默重试
        if (activeIdRef.current === id) {
          timerRef.current = setTimeout(tick, POLL_INTERVAL);
        }
      }
    };

    tick();
  }, [fetchFn, onResult]);

  // 组件卸载时自动清理
  useEffect(() => () => stop(), [stop]);

  return { start, stop };
}
