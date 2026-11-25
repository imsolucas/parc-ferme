import { useCallback, useEffect, useRef, useState } from 'react';
import type { Driver } from '@parc-ferme/shared';
import { api } from './api';

export interface Async<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Minimal data loader: runs `load` on mount and whenever `deps` change. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> {
  const [state, setState] = useState<Omit<Async<T>, 'reload'>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader.current().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error: Error) => live && setState({ data: null, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) };
}

let driverCache: Promise<Driver[]> | null = null;

/** Driver list, fetched once per page load. */
export function useDrivers() {
  const { data } = useAsync(() => (driverCache ??= api.drivers().catch((e) => ((driverCache = null), Promise.reject(e)))), []);
  const list = data ?? [];
  return { list, byNumber: new Map(list.map((d) => [d.number, d])) };
}

/** Current time, re-rendered every `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Persisted on/off preference. */
export function useToggle(key: string, initial: boolean) {
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === '1';
    } catch {
      return initial;
    }
  });
  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        localStorage.setItem(key, v ? '0' : '1');
      } catch {
        /* preference just won't persist */
      }
      return !v;
    });
  }, [key]);
  return [on, toggle] as const;
}

/** Animates a number from 0 up to `target` (arcade score roll-up). */
export function useCountUp(target: number, durationMs = 900, delayMs = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + delayMs;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / durationMs));
      setValue(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Frames can be throttled (background tab): always land on the real score.
    const done = setTimeout(() => setValue(target), delayMs + durationMs + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [target, durationMs, delayMs]);
  return value;
}
