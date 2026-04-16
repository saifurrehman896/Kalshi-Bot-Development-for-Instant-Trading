"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import EventCard from "@/components/EventCard";
import MarketCard from "@/components/MarketCard";
import { useEventDiscovery } from "@/hooks/useMarketData";
import { fetchMarketsByEventTicker, Market } from "@/lib/api";
import { ArrowLeft, Loader2, SearchX } from "lucide-react";
import { useUI } from "@/context/UIContext";

const INITIAL_VISIBLE = 15;
const LOAD_STEP = 15;

export default function HomeClient() {
  const { selectedCategory } = useUI();

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedEventTicker, setSelectedEventTicker] = useState<string | null>(null);
  // NEW: State to store the readable title
  const [selectedEventTitle, setSelectedEventTitle] = useState<string | null>(null);

  const [eventMarkets, setEventMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Reset instantly on category change (NO waiting)
  useEffect(() => {
    setSelectedTag(null);
    setSelectedEventTicker(null);
    setSelectedEventTitle(null); // Reset title
    setEventMarkets([]);
    setVisibleCount(INITIAL_VISIBLE);
  }, [selectedCategory]);

  const { tags, events, isInitialLoading } = useEventDiscovery(
    selectedCategory,
    selectedTag
  );

  // Only render limited number initially
  const visibleEvents = useMemo(() => {
    return events.slice(0, visibleCount);
  }, [events, visibleCount]);

  const loadMore = () => {
    setVisibleCount((prev) => prev + LOAD_STEP);
  };

  // Prevent race conditions for markets
  const marketRequestId = useRef(0);

  const loadMarketsForTicker = async (ticker: string) => {
    const requestId = ++marketRequestId.current;

    setSelectedEventTicker(ticker);
    
    // NEW: Find the event object to get the full title
    const foundEvent = events.find(e => e.event_ticker === ticker);
    if (foundEvent) {
      setSelectedEventTitle(foundEvent.title);
    }

    setLoadingMarkets(true);
    setEventMarkets([]);

    try {
      const data = await fetchMarketsByEventTicker(ticker);

      if (requestId === marketRequestId.current) {
        setEventMarkets(data);
      }
    } finally {
      if (requestId === marketRequestId.current) {
        setLoadingMarkets(false);
      }
    }
  };

  const handleBack = () => {
    setSelectedEventTicker(null);
    setSelectedEventTitle(null); // Reset title
    setEventMarkets([]);
  };

  return (
    <main className="min-h-screen flex flex-col bg-background text-text">
      <div className="flex flex-1 container mx-auto max-w-7xl">
        <Sidebar
          tags={tags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
        />

        <div className="flex-1 p-6">
          {selectedEventTicker ? (
            /* ================= MARKETS VIEW ================= */
            <div className="animate-in fade-in duration-200">
              <button
                onClick={handleBack}
                className="flex items-center text-subtext hover:text-white mb-6 group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Events
              </button>

              <div className="flex flex-col gap-2 mb-8">
                {/* NEW: Event Title Heading */}
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {selectedEventTitle || "Markets"}
                </h2>
                <div className="flex items-center gap-2">
                   <span className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-gray-400">
                     {selectedEventTicker}
                   </span>
                </div>
              </div>

              {loadingMarkets ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-primary w-8 h-8" />
                  <p className="text-sm text-subtext animate-pulse">
                    Fetching Markets...
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {eventMarkets.map((m) => (
                    <MarketCard 
                        key={m.ticker} 
                        market={m} 
                        // NEW: Pass the event title down to the card
                        eventTitle={selectedEventTitle || undefined} 
                    />
                  ))}

                  {eventMarkets.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-subtext border border-dashed border-gray-800 rounded-xl">
                      <SearchX className="w-10 h-10 mb-3 opacity-50" />
                      <p>No open markets found for this ticker.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ================= EVENTS VIEW ================= */
            <div className="animate-in fade-in duration-200">
              <header className="mb-8">
                <h1 className="text-3xl font-bold text-white capitalize">
                  {selectedTag || selectedCategory}
                </h1>
              </header>

              {isInitialLoading && visibleEvents.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-48 bg-surface/50 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {visibleEvents.map((evt) => (
                      <EventCard
                        key={evt.event_ticker}
                        eventData={evt}
                        // Note: Keeping this generic string handler to not break EventCard if it wasn't updated
                        onClick={() => loadMarketsForTicker(evt.event_ticker)}
                      />
                    ))}
                  </div>

                  {/* Load More Button */}
                  {visibleCount < events.length && (
                    <div className="flex justify-center mt-10">
                      <button
                        onClick={loadMore}
                        className="px-6 py-2 rounded-full bg-surface hover:bg-white/10 transition text-sm font-medium"
                      >
                        Load More
                      </button>
                    </div>
                  )}

                  {events.length === 0 && !isInitialLoading && (
                    <div className="col-span-full text-center py-10 text-subtext">
                      No events found for {selectedCategory}.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}