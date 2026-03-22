// 与 Web 端逻辑完全一致，无需改动
import { useRef, useCallback, useEffect } from 'react'

const POLL_INTERVAL = 5000

export function usePolling<T>(
  fetchFn: (id: number) => Promise<T>,
  onResult: (data: T) => { stop: boolean },
) {
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    activeRef.current = null
  }, [])

  const start = useCallback((id: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    activeRef.current = id

    const tick = async () => {
      if (activeRef.current !== id) return
      try {
        const data = await fetchFn(id)
        if (activeRef.current !== id) return
        const { stop: shouldStop } = onResult(data)
        if (!shouldStop && activeRef.current === id) {
          timerRef.current = setTimeout(tick, POLL_INTERVAL)
        }
      } catch {
        // 网络抖动时静默重试
        if (activeRef.current === id) {
          timerRef.current = setTimeout(tick, POLL_INTERVAL)
        }
      }
    }

    tick()
  }, [fetchFn, onResult])

  useEffect(() => () => stop(), [stop])

  return { start, stop }
}
