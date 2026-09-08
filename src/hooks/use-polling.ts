'use client';
import { useEffect } from 'react';

// Schedule after completion; abort stale requests on date changes and unmount.
export function usePolling(callback: (signal: AbortSignal) => Promise<void>, interval = 10000) {
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function run() {
      try { await callback(controller.signal); }
      finally {
        if (!controller.signal.aborted) timer = setTimeout(run, interval);
      }
    }
    void run();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [callback, interval]);
}
