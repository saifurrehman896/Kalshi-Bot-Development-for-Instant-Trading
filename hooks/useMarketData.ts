import { useEffect, useMemo, useRef, useState } from 'react';
// IMPORT the client here
import { fetchSeriesByCategory, KalshiEvent, Series, rateLimitedClient } from '@/lib/api';

const CACHE_TTL = 10 * 60 * 1000;
const SERIES_CACHE = new Map<string, { data: Series[]; ts: number }>();
const EVENTS_CACHE = new Map<string, { data: KalshiEvent[]; ts: number }>();

export function useEventDiscovery(category: string, selectedTag: string | null) {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [events, setEvents] = useState<KalshiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const lastRequestId = useRef(0);

  // 1. Load Series (Sidebar Tags)
  useEffect(() => {
    async function loadSeries() {
      const cached = SERIES_CACHE.get(category);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setSeriesList(cached.data);
        return;
      }
      const data = await fetchSeriesByCategory(category);
      if (data) {
        SERIES_CACHE.set(category, { data, ts: Date.now() });
        setSeriesList(data);
      }
    }
    loadSeries();
  }, [category]);

  // 2. Memoized Tags and Tickers
  const tags = useMemo(() => {
    const set = new Set<string>();
    seriesList.forEach(s => s.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [seriesList]);

  const targetSeriesTickers = useMemo(() => {
    if (!selectedTag) {
      return seriesList.map(s => s.ticker);
    }
    return seriesList.filter(s => s.tags?.includes(selectedTag)).map(s => s.ticker);
  }, [seriesList, selectedTag]);

  // 3. Optimized Event Loader
  useEffect(() => {
  const controller = new AbortController();
  const currentRequestId = ++lastRequestId.current;

  const initialEvents: KalshiEvent[] = [];
  targetSeriesTickers.forEach(ticker => {
    const cached = EVENTS_CACHE.get(ticker);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      initialEvents.push(...cached.data);
    }
  });

  setEvents(initialEvents);
  setLoading(initialEvents.length === 0);

  async function streamEvents() {
    for (const ticker of targetSeriesTickers) {
      if (currentRequestId !== lastRequestId.current) return;
      if (controller.signal.aborted) return;

      const cached = EVENTS_CACHE.get(ticker);
      if (cached && Date.now() - cached.ts < CACHE_TTL) continue;

      try {
        const res = await rateLimitedClient.get('/events', {
          params: { series_ticker: ticker, status: 'open', limit: 50 },
          signal: controller.signal,
        });

        const newEvents = res.data.events || [];
        EVENTS_CACHE.set(ticker, { data: newEvents, ts: Date.now() });

        if (currentRequestId === lastRequestId.current) {
          setEvents(prev => {
            const existing = new Set(prev.map(e => e.event_ticker));
            const unique = newEvents.filter(e => !existing.has(e.event_ticker));
            return [...prev, ...unique];
          });
          setLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Fetch error:", err);
        }
      }
    }

    if (currentRequestId === lastRequestId.current) {
      setLoading(false);
    }
  }

  if (targetSeriesTickers.length > 0) {
    streamEvents();
  } else {
    setLoading(false);
  }

  return () => {
    controller.abort(); // 🚀 CANCEL OLD CATEGORY
  };
}, [targetSeriesTickers]);

  return { tags, events, isInitialLoading: loading };
}