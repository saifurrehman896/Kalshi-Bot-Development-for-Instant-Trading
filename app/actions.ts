// 'use server';

// import { cookies } from 'next/headers';
// import axios from 'axios';
// import crypto from 'crypto';

// const ENV_COOKIE_NAME = 'kalshi_env';
// const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// // Helper to get keys from .env.local
// function getEnvCredentials() {
//   const apiKey = process.env.KALSHI_API_KEY;
//   const privateKey = process.env.KALSHI_PRIVATE_KEY;

//   if (!apiKey || !privateKey) {
//     throw new Error("Missing KALSHI_API_KEY or KALSHI_PRIVATE_KEY in .env.local");
//   }

//   // Handle literal "\n" strings that often occur in .env files
//   const normalizedKey = privateKey.replace(/\\n/g, '\n');
  
//   return { apiKey: apiKey.trim(), privateKey: normalizedKey.trim() };
// }

// export async function setKalshiCredentials(environment: 'demo' | 'real') {
//   const cookieStore = await cookies();

//   cookieStore.set({
//     name: ENV_COOKIE_NAME,
//     value: environment,
//     httpOnly: false,
//     secure: process.env.NODE_ENV === 'production',
//     maxAge: COOKIE_MAX_AGE,
//     path: '/',
//   });
// }

// export async function placeTradeAction(
//   ticker: string,
//   side: 'yes' | 'no',
//   count: number,
//   price: number,
//   isResting: boolean = false
// ) {
//   const { apiKey: API_KEY, privateKey: PRIVATE_KEY_PEM } = getEnvCredentials();
//   const cookieStore = await cookies();
//   const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';

//   const timestamp = Date.now().toString();
//   const method = 'POST';
//   const path = '/trade-api/v2/portfolio/events/orders';
  
//   const baseUrl = environment === 'real' 
//     ? 'https://external-api.kalshi.com' 
//     : 'https://external-api.demo.kalshi.co';

//   try {
//     const message = timestamp + method + path;
//     const signature = crypto.sign(
//       null,
//       Buffer.from(message),
//       {
//         key: PRIVATE_KEY_PEM,
//         padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
//         saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
//       }
//     ).toString('base64');

//     const payload = {
//       ticker,
//       side,
//       action: 'buy',
//       client_order_id: `bot-${Date.now()}`,
//       count,
//       type: 'limit',
//       [`${side}_price`]: price,
//       time_in_force: isResting ? 'good_till_canceled' : 'immediate_or_cancel',
//     };

//     console.log("Payload:", JSON.stringify(payload, null, 2));
    
//     const res = await axios.post(`${baseUrl}${path}`, payload, {
//       headers: {
//         'Content-Type': 'application/json',
//         'KALSHI-ACCESS-KEY': API_KEY,
//         'KALSHI-ACCESS-SIGNATURE': signature,
//         'KALSHI-ACCESS-TIMESTAMP': timestamp,
//       },
//     });

//     return { success: true, data: res.data };
//   } catch (error: any) {
//     return { success: false, error: error.response?.data?.error?.message || 'Trade Failed' };
//   }
// }

// /**
//  * Clears ONLY the resting orders for a specific ticker (market strike).
//  * Uses the batched cancel endpoint — one request cancels up to 20 orders at once.
//  * Orders on other tickers/markets are NOT affected.
//  */
// export async function clearAllRestingOrdersAction(ticker: string) {
//   const { apiKey: API_KEY, privateKey: PRIVATE_KEY_PEM } = getEnvCredentials();
//   const cookieStore = await cookies();
//   const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';

//   const baseUrl = environment === 'real' ? 'https://external-api.kalshi.com' : 'https://external-api.demo.kalshi.co';

//   try {
//     // ── Step 1: Fetch resting orders for this specific ticker ──────────────────
//     const getTimestamp = Date.now().toString();
//     const signingPath = '/trade-api/v2/portfolio/events/orders';
//     const actualUrl = `${baseUrl}${signingPath}?status=resting&ticker=${encodeURIComponent(ticker)}`;
//     // Signing uses only the path (no query string) per Kalshi spec
//     const getMessage = getTimestamp + 'GET' + signingPath;

//     const getSignature = crypto.sign(null, Buffer.from(getMessage), {
//       key: PRIVATE_KEY_PEM,
//       padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
//       saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
//     }).toString('base64');

//     const fetchRes = await axios.get(actualUrl, {
//       headers: {
//         'KALSHI-ACCESS-KEY': API_KEY,
//         'KALSHI-ACCESS-SIGNATURE': getSignature,
//         'KALSHI-ACCESS-TIMESTAMP': getTimestamp,
//       },
//     });

//     const allOrders = fetchRes.data.orders || [];

//     // Extra client-side safety: only cancel orders that exactly match this ticker
//     const orders = allOrders.filter((o: any) => o.ticker === ticker);

//     if (orders.length === 0) {
//       return { success: true, count: 0 };
//     }

//     // ── Step 2: Cancel in batches of 20 (API limit) ────────────────────────────
//     const BATCH_SIZE = 20;
//     let totalCancelled = 0;

//     for (let i = 0; i < orders.length; i += BATCH_SIZE) {
//       const batch = orders.slice(i, i + BATCH_SIZE);

//       const delTimestamp = Date.now().toString();
//       const delPath = '/trade-api/v2/portfolio/events/orders/batched';
//       const delMessage = delTimestamp + 'DELETE' + delPath;

//       const delSignature = crypto.sign(null, Buffer.from(delMessage), {
//         key: PRIVATE_KEY_PEM,
//         padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
//         saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
//       }).toString('base64');

//       await axios.delete(`${baseUrl}${delPath}`, {
//         headers: {
//           'Content-Type': 'application/json',
//           'KALSHI-ACCESS-KEY': API_KEY,
//           'KALSHI-ACCESS-SIGNATURE': delSignature,
//           'KALSHI-ACCESS-TIMESTAMP': delTimestamp,
//         },
//         data: {
//           orders: batch.map((o: any) => ({ order_id: o.order_id })),
//         },
//       });

//       totalCancelled += batch.length;
//     }

//     return { success: true, count: totalCancelled };
//   } catch (error: any) {
//     return { success: false, error: 'Failed to clear orders' };
//   }
// }

'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import https from 'https';

const ENV_COOKIE_NAME = 'kalshi_env';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// Persistent agent to keep the TCP connection alive
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
});

// Helper to get keys from .env.local
function getEnvCredentials() {
  const apiKey = process.env.KALSHI_API_KEY;
  const rawKey = process.env.KALSHI_PRIVATE_KEY;

  if (!apiKey || !rawKey) {
    throw new Error("Missing KALSHI_API_KEY or KALSHI_PRIVATE_KEY in .env.local");
  }

  // Handle literal "\n", extra quotes, and whitespace
  const privateKey = rawKey
    .replace(/\\n/g, '\n') // Replace literal \n with actual newlines
    .replace(/"/g, '')     // Remove any accidental wrapping quotes
    .trim();

  try {
    // Validate and create a KeyObject
    const keyObject = crypto.createPrivateKey(privateKey);
    return { apiKey: apiKey.trim(), privateKey: keyObject };
  } catch (err: any) {
    console.error("Private Key Decode Error:", err.message);
    throw new Error(`Private Key Error: ${err.message}. Ensure your .env.local has the correct PEM format.`);
  }
}

export async function setKalshiCredentials(environment: 'demo' | 'real') {
  const cookieStore = await cookies();

  cookieStore.set({
    name: ENV_COOKIE_NAME,
    value: environment,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Optimized placeTradeAction using fetch
 */
export async function placeTradeAction(
  ticker: string,
  side: 'yes' | 'no',
  count: number,
  price: number,
  isResting: boolean = false
) {
  const { apiKey: API_KEY, privateKey: PRIVATE_KEY_OBJ } = getEnvCredentials();
  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';

  const timestamp = Date.now().toString();
  const method = 'POST';
  const path = '/trade-api/v2/portfolio/events/orders';
  
  const baseUrl = environment === 'real' 
    ? 'https://external-api.kalshi.com' 
    : 'https://external-api.demo.kalshi.co';

  try {
    const message = timestamp + method + path;
    const signature = crypto.sign(
      null,
      Buffer.from(message),
      {
        key: PRIVATE_KEY_OBJ,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      }
    ).toString('base64');

    const cleanPrice = isNaN(price) ? 99 : Math.max(1, Math.min(99, Math.round(price)));

    const payload = {
      ticker,
      client_order_id: `bot-${Date.now()}`,
      side: side === 'yes' ? 'bid' : 'ask',
      count: count.toString(),
      type: 'limit',
      price: (side === 'yes' ? cleanPrice / 100 : (100 - cleanPrice) / 100).toFixed(2),
      time_in_force: isResting ? 'good_till_canceled' : 'immediate_or_cancel',
      self_trade_prevention_type: 'taker_at_cross',
    };

    console.log(`[TRADE SENT] Ticker: ${ticker} | Side: ${payload.side} | Price: $${payload.price} | Qty: ${payload.count}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'KALSHI-ACCESS-KEY': API_KEY,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
      },
      body: JSON.stringify(payload),
      // @ts-ignore
      agent: keepAliveAgent,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const data = await res.json();
    
    if (!res.ok) {
      console.error("[TRADE ERROR RESPONSE]", JSON.stringify(data, null, 2));
      throw new Error(data?.error?.message || 'Trade Failed');
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Trade Failed' };
  }
}

/**
 * Optimized clearAllRestingOrdersAction using fetch
 */
export async function clearAllRestingOrdersAction(ticker: string) {
  const { apiKey: API_KEY, privateKey: PRIVATE_KEY_OBJ } = getEnvCredentials();
  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';

  const baseUrl = environment === 'real' ? 'https://external-api.kalshi.com' : 'https://external-api.demo.kalshi.co';

  try {
    // ── Step 1: Fetch resting orders
    const getTimestamp = Date.now().toString();
    const signingPath = '/trade-api/v2/portfolio/events/orders';
    const actualUrl = `${baseUrl}${signingPath}?status=resting&ticker=${encodeURIComponent(ticker)}`;
    const getMessage = getTimestamp + 'GET' + signingPath;

    const getSignature = crypto.sign(null, Buffer.from(getMessage), {
      key: PRIVATE_KEY_OBJ,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }).toString('base64');

    const fetchRes = await fetch(actualUrl, {
      method: 'GET',
      headers: {
        'KALSHI-ACCESS-KEY': API_KEY,
        'KALSHI-ACCESS-SIGNATURE': getSignature,
        'KALSHI-ACCESS-TIMESTAMP': getTimestamp,
      },
      // @ts-ignore
      agent: keepAliveAgent,
    });

    const fetchData = await fetchRes.json();
    const allOrders = fetchData.orders || [];
    const orders = allOrders.filter((o: any) => o.ticker === ticker);

    if (orders.length === 0) {
      return { success: true, count: 0 };
    }

    // ── Step 2: Cancel in batches of 20
    const BATCH_SIZE = 20;
    let totalCancelled = 0;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      const delTimestamp = Date.now().toString();
      const delPath = '/trade-api/v2/portfolio/events/orders/batched';
      const delMessage = delTimestamp + 'DELETE' + delPath;

      const delSignature = crypto.sign(null, Buffer.from(delMessage), {
        key: PRIVATE_KEY_OBJ,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      }).toString('base64');

      const delRes = await fetch(`${baseUrl}${delPath}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'KALSHI-ACCESS-KEY': API_KEY,
          'KALSHI-ACCESS-SIGNATURE': delSignature,
          'KALSHI-ACCESS-TIMESTAMP': delTimestamp,
        },
        body: JSON.stringify({
          orders: batch.map((o: any) => ({ order_id: o.order_id })),
        }),
        // @ts-ignore
        agent: keepAliveAgent,
      });

      if (delRes.ok) {
        totalCancelled += batch.length;
      }
    }

    return { success: true, count: totalCancelled };
  } catch (error: any) {
    return { success: false, error: 'Failed to clear orders' };
  }
}

/**
 * Server-side OrderBook fetcher to avoid proxy issues and ECONNRESET
 */
export async function fetchOrderBookAction(ticker: string) {
  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';
  const baseUrl = environment === 'real' 
    ? 'https://external-api.kalshi.com' 
    : 'https://external-api.demo.kalshi.co';

  try {
    const res = await fetch(`${baseUrl}/trade-api/v2/markets/${ticker}/orderbook`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KalshiBot/1.0',
      },
      // @ts-ignore
      agent: keepAliveAgent,
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;
    const rawData = await res.json();

    if (rawData.orderbook_fp) {
      return {
        orderbook: {
          yes: rawData.orderbook_fp.yes_dollars.map(([p, q]: [string, string]) => [
            Math.round(parseFloat(p) * 100),
            Math.round(parseFloat(q))
          ]).sort((a: any, b: any) => b[0] - a[0]),
          no: rawData.orderbook_fp.no_dollars.map(([p, q]: [string, string]) => [
            Math.round(parseFloat(p) * 100),
            Math.round(parseFloat(q))
          ]).sort((a: any, b: any) => b[0] - a[0])
        }
      };
    }
    return rawData;
  } catch (err) {
    console.error(`Orderbook fetch error for ${ticker}:`, err);
    return null;
  }
}

/**
 * Batch OrderBook fetcher to reduce the number of requests from the client.
 */
export async function fetchMultipleOrderBooksAction(tickers: string[]) {
  if (!tickers || tickers.length === 0) return {};

  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';
  const baseUrl = environment === 'real' 
    ? 'https://external-api.kalshi.com' 
    : 'https://external-api.demo.kalshi.co';

  // Use Promise.all to fetch all orderbooks in parallel on the server
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const res = await fetch(`${baseUrl}/trade-api/v2/markets/${ticker}/orderbook`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'KalshiBot/1.0',
          },
          // @ts-ignore
          agent: keepAliveAgent,
          next: { revalidate: 0 },
        });

        if (!res.ok) return [ticker, null];
        const rawData = await res.json();

        let formatted = rawData;
        if (rawData.orderbook_fp) {
          formatted = {
            orderbook: {
              yes: rawData.orderbook_fp.yes_dollars.map(([p, q]: [string, string]) => [
                Math.round(parseFloat(p) * 100),
                Math.round(parseFloat(q))
              ]).sort((a: any, b: any) => b[0] - a[0]),
              no: rawData.orderbook_fp.no_dollars.map(([p, q]: [string, string]) => [
                Math.round(parseFloat(p) * 100),
                Math.round(parseFloat(q))
              ]).sort((a: any, b: any) => b[0] - a[0])
            }
          };
        }
        return [ticker, formatted];
      } catch (err) {
        return [ticker, null];
      }
    })
  );

  return Object.fromEntries(results);
}

/**
 * Server-side Markets fetcher
 */
export async function fetchMarketsAction(eventTicker: string) {
  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';
  const baseUrl = environment === 'real' 
    ? 'https://external-api.kalshi.com' 
    : 'https://external-api.demo.kalshi.co';

  try {
    const res = await fetch(`${baseUrl}/trade-api/v2/markets?limit=1000&event_ticker=${eventTicker}&status=open`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KalshiBot/1.0',
      },
      // @ts-ignore
      agent: keepAliveAgent,
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.markets || [];
  } catch (err) {
    console.error(`Markets fetch error for ${eventTicker}:`, err);
    return [];
  }
}

/**
 * Server-side Event fetcher
 */
export async function fetchEventAction(ticker: string) {
  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';
  const baseUrl = environment === 'real' 
    ? 'https://external-api.kalshi.com' 
    : 'https://external-api.demo.kalshi.co';

  try {
    const res = await fetch(`${baseUrl}/trade-api/v2/events/${ticker}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KalshiBot/1.0',
      },
      // @ts-ignore
      agent: keepAliveAgent,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.event;
  } catch (err) {
    console.error(`Event fetch error for ${ticker}:`, err);
    return null;
  }
}

/**
 * Server-side Positions fetcher
 */
export async function fetchPositionsAction() {
  const { apiKey: API_KEY, privateKey: PRIVATE_KEY_OBJ } = getEnvCredentials();
  const cookieStore = await cookies();
  const environment = cookieStore.get(ENV_COOKIE_NAME)?.value || 'demo';

  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/trade-api/v2/portfolio/positions';
  
  const baseUrl = environment === 'real' 
    ? 'https://external-api.kalshi.com' 
    : 'https://external-api.demo.kalshi.co';

  try {
    const message = timestamp + method + path;
    const signature = crypto.sign(
      null,
      Buffer.from(message),
      {
        key: PRIVATE_KEY_OBJ,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      }
    ).toString('base64');

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'KALSHI-ACCESS-KEY': API_KEY,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
      },
      // @ts-ignore
      agent: keepAliveAgent,
      next: { revalidate: 0 },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message || 'Failed to fetch positions');
    }

    return { success: true, positions: data.market_positions || data.positions || [] };
  } catch (error: any) {
    console.error("Positions fetch error:", error);
    return { success: false, error: error.message || 'Failed to fetch positions' };
  }
}
