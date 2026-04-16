"use client";

import { useState, useRef } from 'react';
import { fetchMarketsByEventTicker, fetchEventByTicker, Market } from '@/lib/api';
import MarketCard from '@/components/MarketCard';
import { ArrowRight, Link as LinkIcon, Loader2, Zap, Grid3X3 } from 'lucide-react';

const COLUMN_OPTIONS = [4, 5, 6, 7, 8] as const;

export default function QuickTradePage() {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [gridCols, setGridCols] = useState(8);
  const prefetchCache = useRef<Map<string, Promise<any>>>(new Map());

  const extractAndValidateTicker = (url: string) => {
    try {
      if (!url.includes('/')) return null;
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      if (!lastPart) return null;
      const ticker = lastPart.split('?')[0].toUpperCase();
      const isValidTicker = /^[A-Z0-9-]+$/.test(ticker) && ticker.length >= 3;
      return isValidTicker ? ticker : null;
    } catch {
      return null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);

    const ticker = extractAndValidateTicker(val);
    
    if (ticker && !prefetchCache.current.has(ticker)) {
      console.log("🚀 Pre-fetching data for:", ticker);
      const fetchPromise = (async () => {
        try {
          const [marketData, eventData] = await Promise.all([
            fetchMarketsByEventTicker(ticker),
            fetchEventByTicker(ticker)
          ]);
          if (!marketData || marketData.length === 0) throw new Error("No open markets");
          return { success: true, marketData, eventData };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      })();
      prefetchCache.current.set(ticker, fetchPromise);
    }
  };

  const handleSweep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    setLoading(true);
    setError(null);
    setMarkets([]);
    setEventTitle(null);
    setCurrentTicker(null);

    try {
      const ticker = extractAndValidateTicker(urlInput);

      if (!ticker) {
        const parts = urlInput.split('/');
        const lastPart = parts[parts.length - 1]; 
        const rawTicker = lastPart?.split('?')[0]?.toUpperCase();
        if (!rawTicker || rawTicker.length < 3) throw new Error("Could not extract a valid ticker from this URL.");
      }

      if (ticker) {
        console.log("Extracted Ticker:", ticker);
        setCurrentTicker(ticker);

        let result;
        if (prefetchCache.current.has(ticker)) {
          result = await prefetchCache.current.get(ticker);
        } else {
          const [marketData, eventData] = await Promise.all([
            fetchMarketsByEventTicker(ticker),
            fetchEventByTicker(ticker)
          ]);
          result = { success: true, marketData, eventData };
        }

        if (!result.success) {
          throw new Error(result.error || `No open markets found for ticker: ${ticker}`);
        }

        if (!result.marketData || result.marketData.length === 0) {
          throw new Error(`No open markets found for ticker: ${ticker}`);
        }

        if (result.eventData) {
          setEventTitle(result.eventData.title);
        }
        setMarkets(result.marketData);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load market.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    const updatedMarkets = [...markets];
    const draggedMarket = updatedMarkets[draggedIndex];
    
    updatedMarkets.splice(draggedIndex, 1);
    updatedMarkets.splice(index, 0, draggedMarket);
    
    setMarkets(updatedMarkets);
    setDraggedIndex(null);
  };

  // Remove a strike from the view entirely
  const handleRemoveMarket = (ticker: string) => {
    setMarkets((prev) => prev.filter((m) => m.ticker !== ticker));
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col items-center pt-20 px-4">
      
      {/* --- HEADER --- */}
      <div className="text-center mb-10 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-900/20 mb-4">
          <Zap className="w-8 h-8 text-white fill-white" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Quick Trade</h1>
        <p className="text-subtext max-w-md mx-auto">
          Paste a Kalshi Event URL below to instantly load its markets and sweep OrderBook liquidity.
        </p>
      </div>

      {/* --- INPUT --- */}
      <form onSubmit={handleSweep} className="w-full max-w-2xl relative group mb-12">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <LinkIcon className="w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="https://demo.kalshi.co/markets/..." 
          className="w-full bg-[#1a1a1a] border border-gray-800 text-white rounded-xl pl-12 pr-32 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-xl placeholder:text-gray-600 font-mono text-sm"
          value={urlInput}
          onChange={handleInputChange}
        />
        <button 
          type="submit"
          disabled={loading || !urlInput}
          className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Load <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>

      {/* --- RESULTS --- */}
      <div className="w-full max-w-[2400px]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-center mb-8 animate-in fade-in slide-in-from-bottom-2">
            {error}
          </div>
        )}

        {markets.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 mb-8">
            {/* Event Title Header + Grid Controls */}
            <div className="flex flex-col items-center gap-2 mb-6">
              <h2 className="text-3xl font-bold text-white leading-tight text-center">
                {eventTitle || "Event Markets"} 
              </h2>
              <div className="flex items-center gap-3">
                {currentTicker && (
                  <span className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-gray-400">
                    {currentTicker}
                  </span>
                )}
                {/* Column selector */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                  <Grid3X3 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 mr-1">Cols</span>
                  {COLUMN_OPTIONS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setGridCols(col)}
                      className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                        gridCols === col
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                          : 'text-gray-500 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Customizable grid — gap scales with column count for visual balance */}
            <div
              className="grid pb-20 transition-all duration-300"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gap: `${Math.max(8, 28 - gridCols * 2.5)}px`,
              }}
            >
              {markets.map((market, index) => (
                <div 
                  key={market.ticker} 
                  className="cursor-move transition-transform duration-200 hover:scale-[1.01]"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                >
                  <MarketCard 
                    market={market} 
                    eventTitle={eventTitle || undefined}
                    onRemove={handleRemoveMarket}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}