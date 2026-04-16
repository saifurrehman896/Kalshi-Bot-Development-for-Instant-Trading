// components/EventCard.tsx
import React from 'react';
import { KalshiEvent, fetchMarketsByEventTicker, fetchOrderBook } from '@/lib/api';
import { Calendar, ChevronRight, ArrowUpRight } from 'lucide-react';

interface EventCardProps {
  eventData: KalshiEvent;
  onClick: (eventTicker: string) => void;
}

export default function EventCard({ eventData, onClick }: EventCardProps) {
  const date = new Date(eventData.strike_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  // SPEED HACK: Prefetch everything when user hovers
  const handlePrefetch = async () => {
    try {
      // 1. Get the markets for this event
      const markets = await fetchMarketsByEventTicker(eventData.event_ticker);
      
      // 2. Queue up orderbook fetches for the first 5 markets (most popular)
      markets.slice(0, 5).forEach(market => {
        fetchOrderBook(market.ticker); 
      });
    } catch (e) {
      // Ignore prefetch errors silently
    }
  };

  return (
    <div 
      onClick={() => onClick(eventData.event_ticker)}
      onMouseEnter={handlePrefetch}
      className="group cursor-pointer bg-surface border border-gray-800 rounded-lg p-5 hover:bg-[#1e1e1e] hover:border-accent transition-colors flex flex-col h-full"
    >
      {/* Ticker & Date Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-bold font-mono tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
          {eventData.event_ticker}
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-subtext">
          <Calendar className="w-3 h-3" />
          <span>{date}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors leading-tight">
            {eventData.title}
          </h3>
          <ArrowUpRight className="w-4 h-4 text-gray-700 group-hover:text-accent transition-colors flex-shrink-0" />
        </div>
        
        <p className="text-subtext text-sm leading-snug line-clamp-2">
          {eventData.sub_title}
        </p>
      </div>

      {/* Footer CTA */}
      <div className="mt-6 pt-4 border-t border-gray-800/60 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-tight">
          Active Markets
        </span>
        <div className="flex items-center text-white text-xs font-bold uppercase tracking-wide">
          Trade Now <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
} 