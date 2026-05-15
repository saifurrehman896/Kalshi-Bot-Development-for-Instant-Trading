//lib/api.ts
import axios from 'axios';


const RATE_LIMIT_INTERVAL = 100; 
const ORDERBOOK_TTL = 300; 

export const rateLimitedClient = axios.create();

let nextRequestTime = Date.now();

rateLimitedClient.interceptors.request.use(async (config) => {
  
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split('; ');
    const envCookie = cookies.find(row => row.startsWith('kalshi_env='));
    const env = envCookie ? envCookie.split('=')[1] : 'demo';
    
    // Set the proxy based on the environment
    config.baseURL = env === 'real' ? '/kalshi-prod' : '/kalshi-demo';
  }

  // 2. RATE LIMITING LOGIC
  const now = Date.now();
  const wait = Math.max(0, nextRequestTime - now);
  nextRequestTime = Math.max(now, nextRequestTime) + RATE_LIMIT_INTERVAL;
  
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  return config;
});

// --- TYPES ---
export interface Series { 
  ticker: string; 
  title: string; 
  category: string; 
  tags: string[] | null; 
}

export interface KalshiEvent { 
  event_ticker: string; 
  series_ticker: string; 
  title: string; 
  sub_title: string; 
  category: string; 
  strike_date: string; 
  status: string; 
}

export interface Market { 
  ticker: string; 
  event_ticker: string; 
  title: string; 
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars: string; 
  no_bid_dollars: string; 
  yes_bid?: number;
  no_bid?: number;
  yes_ask?: number;
  no_ask?: number;
  volume: number; 
  liquidity?: number;
  expiration_time?: string;
  status: string; 
}

// export interface OrderBookResponse { 
//   orderbook: { 
//     yes: [number, number][]; 
//     no: [number, number][]; 
//   } 
// }

// --- CACHE ENGINE ---
const CACHE_TTL_DEFAULT = 5 * 60 * 1000; 
const cache = new Map<string, { data: any; ts: number }>();
const inflight = new Map<string, Promise<any>>();

/**
 * Creates a cached version of a fetch function.
 * Supports AbortSignal to cancel requests if the component unmounts.
 */
function createCachedFetcher<T, A extends any[]>(
  keyPrefix: string, 
  fetcher: (...args: A) => Promise<T>, 
  customTtl?: number
) {
  return async (...args: A): Promise<T> => {
    // Generate cache key based on arguments (ignoring AbortSignal for key generation)
    const safeArgs = args.filter(a => !(a instanceof AbortSignal));
    const key = `${keyPrefix}:${JSON.stringify(safeArgs)}`;
    
    // 1. Return In-Flight Promise (Deduplication)
    if (inflight.has(key)) {
      return inflight.get(key)!;
    }

    // 2. Return Cached Data (Speed)
    const cached = cache.get(key);
    const ttl = customTtl || CACHE_TTL_DEFAULT;
    if (cached && Date.now() - cached.ts < ttl) {
      return cached.data;
    }

    // 3. Fetch Fresh
    const promise = fetcher(...args).then(data => {
      cache.set(key, { data, ts: Date.now() });
      inflight.delete(key);
      return data;
    }).catch(err => {
      inflight.delete(key);
      throw err;
    });

    inflight.set(key, promise);
    return promise;
  };
}

// --- API FUNCTIONS ---

export const fetchSeriesByCategory = createCachedFetcher('series', (category: string) =>
  rateLimitedClient.get('/series', { params: { category } }).then(res => res.data.series as Series[])
);

export const fetchAllOpenEvents = createCachedFetcher('all-events', (_: void) =>
  rateLimitedClient.get('/events', { params: { limit: 200, status: 'open' } }).then(res => res.data.events as KalshiEvent[])
);

export const fetchEventByTicker = createCachedFetcher('event-details', (ticker: string) =>
  rateLimitedClient.get(`/events/${ticker}`).then(res => res.data.event as KalshiEvent)
);

export const fetchMarketsByEventTicker = createCachedFetcher('markets', (eventTicker: string) =>
  rateLimitedClient.get('/markets', { params: { limit: 1000, event_ticker: eventTicker, status: 'open' } }).then(res => res.data.markets as Market[])
);
// --- UPDATED TYPES ---
export interface OrderBookResponse { 
  // Keep this key for backward compatibility with your component
  orderbook: { 
    yes: [number, number][]; 
    no: [number, number][]; 
  } 
}

// Internal interface for the raw API response
interface RawKalshiOrderbook {
  orderbook_fp?: {
    yes_dollars: [string, string][];
    no_dollars: [string, string][];
  }
}

export const fetchOrderBook = createCachedFetcher(
  'orderbook', 
  async (marketTicker: string, signal?: AbortSignal) => {
    try {
      const res = await rateLimitedClient.get(`/markets/${marketTicker}/orderbook`, { signal });
      const rawData = res.data as RawKalshiOrderbook;

      // 1. Check if the new orderbook_fp exists
      if (rawData.orderbook_fp) {
        return {
          orderbook: {
            // Convert "0.1500" (string) -> 15 (number)
            // Convert "100.00" (string) -> 100 (number)
            yes: rawData.orderbook_fp.yes_dollars.map(([p, q]) => [
              Math.round(parseFloat(p) * 100), 
              Math.round(parseFloat(q))
            ]),
            no: rawData.orderbook_fp.no_dollars.map(([p, q]) => [
              Math.round(parseFloat(p) * 100), 
              Math.round(parseFloat(q))
            ])
          }
        } as OrderBookResponse;
      }

      return res.data as OrderBookResponse;
    } catch (error: any) {
      if (axios.isCancel(error)) throw error;
      return null;
    }
  }, 
  ORDERBOOK_TTL
);
// UPDATED: Now accepts an optional AbortSignal
// export const fetchOrderBook = createCachedFetcher(
//   'orderbook', 
//   async (marketTicker: string, signal?: AbortSignal) => {
//     try {
//       const res = await rateLimitedClient.get(
//         `/markets/${marketTicker}/orderbook`,
//         { signal } // Pass signal to Axios
//       );
//       return res.data as OrderBookResponse;
//     } catch (error: any) {
//       if (axios.isCancel(error)) {
//         throw error; // Let the caller know it was cancelled
//       }
//       return null;
//     }
//   }, 
//   ORDERBOOK_TTL
// );