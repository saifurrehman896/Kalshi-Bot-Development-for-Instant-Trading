"use client";
import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Market, fetchOrderBook } from "@/lib/api";
import { placeTradeAction, clearAllRestingOrdersAction, fetchOrderBookAction, fetchPositionsAction } from "@/app/actions";
import { Loader2, AlertCircle, CheckCircle2, X, Target } from "lucide-react";

// ─── LADDER ROW ────────────────────────────────────────────────────────────────
const LadderRow = React.memo(({
  price, qty, type,
}: { price: number; qty: number; type: "bid" | "ask" }) => {
  const [flash, setFlash] = useState("");
  const prevQty = React.useRef(qty);

  useEffect(() => {
    if (prevQty.current !== qty) {
      setFlash(type === "bid" ? "bg-emerald-500/25" : "bg-rose-500/25");
      const t = setTimeout(() => setFlash(""), 350);
      prevQty.current = qty;
      return () => clearTimeout(t);
    }
  }, [qty, type]);

  return (
    <div className={`flex justify-between items-center h-[22px] px-1 rounded transition-colors duration-300 ${flash}`}>
      <span className={`text-[10px] font-mono font-bold tabular-nums leading-none ${type === "bid" ? "text-emerald-400" : "text-rose-400"
        }`}>
        {price}¢
      </span>
      <span className="text-[10px] font-mono text-gray-500 tabular-nums leading-none">{qty}</span>
    </div>
  );
});
LadderRow.displayName = "LadderRow";

// ─── ORDER BOOK LADDER ─────────────────────────────────────────────────────────
// Layout: left col = Asks (red, low to high top to bottom), right col = Bids (green)
const OrderBookLadder = ({ rawYes, rawNo }: {
  rawYes: [number, number][];
  rawNo: [number, number][];
}) => {
  // Bids on YES side (green) — sorted best first
  const yesBids = useMemo(() =>
    [...rawYes].sort((a, b) => b[0] - a[0]).slice(0, 4), [rawYes]);

  // Asks on YES side = NO bids converted — sorted worst-to-best (so best ask at bottom, near spread)
  const yesAsks = useMemo(() =>
    rawNo
      .map(([p, q]): [number, number] => [100 - p, q])
      .sort((a, b) => a[0] - b[0])
      .slice(0, 4)
      .reverse(),
    [rawNo]);

  return (
    <div className="w-full">
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-[2px] mb-[2px]">
        <div className="flex justify-between px-1 py-[3px] bg-[#141414] rounded-t-sm">
          <span className="text-[8px] text-gray-600 font-bold uppercase">Ask</span>
          <span className="text-[8px] text-gray-600 font-bold uppercase">Qty</span>
        </div>
        <div className="flex justify-between px-1 py-[3px] bg-[#141414] rounded-t-sm">
          <span className="text-[8px] text-gray-600 font-bold uppercase">Bid</span>
          <span className="text-[8px] text-gray-600 font-bold uppercase">Qty</span>
        </div>
      </div>
      {/* Data rows */}
      <div className="grid grid-cols-2 gap-[2px]">
        <div className="bg-[#0d0d0d] rounded-b-sm py-px">
          {yesAsks.length > 0
            ? yesAsks.map(([p, q], i) => <LadderRow key={`a-${p}-${i}`} price={p} qty={q} type="ask" />)
            : <div className="h-[22px] flex items-center justify-center text-gray-700 text-[9px] italic">—</div>}
        </div>
        <div className="bg-[#0d0d0d] rounded-b-sm py-px">
          {yesBids.length > 0
            ? yesBids.map(([p, q], i) => <LadderRow key={`b-${p}-${i}`} price={p} qty={q} type="bid" />)
            : <div className="h-[22px] flex items-center justify-center text-gray-700 text-[9px] italic">—</div>}
        </div>
      </div>
    </div>
  );
};

// ─── SMALL PRESET BUTTON ───────────────────────────────────────────────────────
const Chip = ({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 h-[22px] rounded text-[9px] font-mono font-bold border transition-colors ${active
      ? "bg-[#2a2a2a] text-white border-[#505050]"
      : "bg-[#111] text-gray-600 border-[#252525] hover:text-gray-300 hover:border-[#3a3a3a]"
      }`}
  >
    {label}
  </button>
);

// ─── TRADE RESULT ──────────────────────────────────────────────────────────────
interface TradeResult { type: "success" | "error"; message: string; id: number; }

// ─── MAIN ──────────────────────────────────────────────────────────────────────
const MarketCardComponent = ({
  market, eventTitle, onRemove, externalOrderbook, externalPosition, noPoll
}: {
  market: Market;
  eventTitle?: string;
  onRemove?: (ticker: string) => void;
  externalOrderbook?: { yes: [number, number][]; no: [number, number][]; } | null;
  externalPosition?: { count: number; side: 'yes' | 'no'; price: number } | null;
  noPoll?: boolean;
}) => {
  const [isTrading, setIsTrading] = useState(false);
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const [targetQty, setTargetQty] = useState<number | null>(5000);
  const [targetPrice, setTargetPrice] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(true);   // ON by default
  const [isClearingOrders, setIsClearingOrders] = useState(false);

  const [orderbook, setOrderbook] = useState<{ yes: [number, number][]; no: [number, number][]; }>(() => ({
    yes: market.yes_bid ? [[market.yes_bid, 100]] : [],
    no: market.yes_ask ? [[100 - market.yes_ask, 100]] : [],
  }));

  const [position, setPosition] = useState<{ count: number; side: 'yes' | 'no'; price: number } | null>(null);

  // polling ────────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    // If we're getting external updates, don't poll internally
    if (externalOrderbook) return;
    try {
      const data = await fetchOrderBookAction(market.ticker);
      if (data?.orderbook) {
        const yes = (data.orderbook.yes || []).sort((a: any, b: any) => b[0] - a[0]);
        const no = (data.orderbook.no || []).sort((a: any, b: any) => b[0] - a[0]);
        setOrderbook({ yes, no });
      }

      // Also fetch position if not external
      if (!externalPosition) {
        const posRes = await fetchPositionsAction();
        if (posRes.success && posRes.positions) {
          const myPos = posRes.positions.find((p: any) =>
            p.ticker?.toUpperCase() === market.ticker?.toUpperCase() ||
            p.market_ticker?.toUpperCase() === market.ticker?.toUpperCase()
          );
          if (myPos) {
            // Support both integer 'position' and string 'position_fp'
            const rawPos = myPos.position ?? myPos.position_fp ?? 0;
            const count = Math.abs(Number(rawPos));

            if (count !== 0) {
              const getCents = (val: any) => {
                if (val === undefined || val === null || val === '') return 0;
                const num = parseFloat(String(val));
                if (isNaN(num)) return 0;
                // If it's a dollar string (has a dot), convert to cents but keep decimals
                if (typeof val === 'string' && val.includes('.')) return num * 100;
                return num;
              };

              // Kalshi v2 doesn't always provide average_price directly in market_positions.
              // We can calculate it from total_cost_dollars / position_fp if available.
              const cost = parseFloat(myPos.total_cost_dollars || myPos.cost_basis_dollars || myPos.position_cost_dollars || myPos.total_traded_dollars || myPos.total_cost || myPos.cost || "0");
              const shares = Math.abs(parseFloat(myPos.total_cost_shares_fp || myPos.position_fp || myPos.position || String(count)));

              let avgPrice = 0;
              if (shares > 0 && cost > 0) {
                avgPrice = (cost / shares) * 100;
              } else {
                avgPrice = getCents(
                  myPos.average_price ?? 
                  myPos.avg_price ?? 
                  myPos.avg_cost_basis_dollars ?? 
                  myPos.avg_cost_basis ?? 
                  myPos.average_fill_price ??
                  myPos.price ??
                  0
                );
              }

              setPosition({
                count: count,
                side: (myPos.side?.toLowerCase() === 'yes' || myPos.side?.toLowerCase() === 'no')
                  ? myPos.side.toLowerCase() as 'yes' | 'no'
                  : (Number(rawPos) > 0 ? 'yes' : 'no'),
                price: avgPrice
              });
              // @ts-ignore
              window.DEBUG_POSITIONS = myPos;
            } else {
              setPosition(null);
            }
          } else {
            setPosition(null);
          }
        }
      }
    } catch { /* silent */ }
  }, [market.ticker, externalOrderbook, externalPosition]);

  useEffect(() => {
    // Synchronize with external orderbook if provided
    if (externalOrderbook) {
      const sortedYes = [...(externalOrderbook.yes || [])].sort((a, b) => b[0] - a[0]);
      const sortedNo = [...(externalOrderbook.no || [])].sort((a, b) => b[0] - a[0]);
      setOrderbook({ yes: sortedYes, no: sortedNo });
    }

    // If noPoll is true, we never start the interval
    if (noPoll) return;

    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh, externalOrderbook, noPoll]);

  // derived ────────────────────────────────────────────────────────────────────
  // Calculate total liquidity specifically under the 2c "Target" cap
  // A bid at 99c (p=99) means you buy the other side at 1c (100-p=1)
  const targetYesLiq = useMemo(() =>
    orderbook.no.reduce((s, [p, q]) => (p >= 98 ? s + q : s), 0),
    [orderbook.no]);

  const targetNoLiq = useMemo(() =>
    orderbook.yes.reduce((s, [p, q]) => (p >= 98 ? s + q : s), 0),
    [orderbook.yes]);

  // General max liquidity for manual trades
  const maxYesLiq = useMemo(() => orderbook.no.reduce((s, [, q]) => s + q, 0), [orderbook.no]);
  const maxNoLiq = useMemo(() => orderbook.yes.reduce((s, [, q]) => s + q, 0), [orderbook.yes]);

  // Robust best price detection
  const bestYesPrice = useMemo(() => {
    const bids = orderbook.no.map(o => o[0]);
    return bids.length > 0 ? 100 - Math.max(...bids) : null;
  }, [orderbook.no]);

  const bestNoPrice = useMemo(() => {
    const bids = orderbook.yes.map(o => o[0]);
    return bids.length > 0 ? 100 - Math.max(...bids) : null;
  }, [orderbook.yes]);

  const displayTitle = useMemo(() => {
    if (market.yes_sub_title && market.yes_sub_title === market.no_sub_title)
      return market.yes_sub_title;
    return market.title;
  }, [market.title, market.yes_sub_title, market.no_sub_title]);

  // trade ──────────────────────────────────────────────────────────────────────
  const toast = (type: "success" | "error", message: string) =>
    setTradeResult({ type, message, id: Date.now() });

  // const handleTrade = async (side: "yes"|"no", qtyOverride?: number) => {
  //   if (isTrading) return;
  //   const maxAvail = side === "yes" ? maxYesLiq : maxNoLiq;
  //   const qty  = qtyOverride ?? targetQty ?? maxAvail;
  //   const cap  = targetPrice ?? 99;
  //   const mktp = side === "yes" ? bestYesPrice : bestNoPrice;

  //   if (!qty || qty <= 0) { toast("error", "Fetching liquidity…"); setTimeout(() => setTradeResult(null), 1000); return; }
  //   setIsTrading(true);
  //   try {
  //     const res = await placeTradeAction(market.ticker, side, qty, cap, isResting);
  //     if (!res.success) throw new Error(res.error || "Trade rejected");
  //     toast("success", `${qty} ${side.toUpperCase()} @ ${mktp ?? "?"}¢`);
  //     refresh();
  //   } catch (e: any) {
  //     toast("error", e.message || "Failed");
  //   } finally {
  //     setIsTrading(false);
  //     setTimeout(() => setTradeResult(p => p && Date.now()-p.id > 1000 ? null : p), 1500);
  //   }
  // };
  // inside MarketCard component
  const handleTrade = async (side: "yes" | "no", qtyOverride?: number) => {
    if (isTrading) return;

    const qty = qtyOverride ?? targetQty ?? (side === "yes" ? maxYesLiq : maxNoLiq);
    const mktp = side === "yes" ? bestYesPrice : bestNoPrice;

    if (!qty || qty <= 0) {
      toast("error", "Fetching liquidity...");
      return;
    }

    // 1. SET LOCAL LOADING (Button only, not full screen)
    setIsTrading(true);

    // 2. SHOW IMMEDIATE OPTIMISTIC TOAST
    const optimisticId = Date.now();
    setTradeResult({
      type: "success",
      message: `Sending ${qty} ${side.toUpperCase()}...`,
      id: optimisticId
    });

    try {
      // 3. TRIGGER ACTION (Don't let it block the UI flow)
      const res = await placeTradeAction(market.ticker, side, qty, targetPrice ?? 99, isResting);

      if (!res.success) throw new Error(res.error || "Trade rejected");

      // 4. UPDATE TOAST ON ACTUAL SUCCESS
      setTradeResult({
        type: "success",
        message: `${qty} ${side.toUpperCase()} @ ${mktp ?? "?"}¢`,
        id: Date.now()
      });

      refresh(); // Refresh orderbook immediately
    } catch (e: any) {
      setTradeResult({ type: "error", message: e.message || "Failed", id: Date.now() });
    } finally {
      setIsTrading(false);
      // Auto-clear toast later
      setTimeout(() => {
        setTradeResult(p => (p && Date.now() - p.id > 2000 ? null : p));
      }, 3000);
    }
  };

  // clear ──────────────────────────────────────────────────────────────────────
  const handleClearResting = async () => {
    if (isClearingOrders) return;
    setIsClearingOrders(true);
    try {
      const res = await clearAllRestingOrdersAction(market.ticker);
      if (!res.success) throw new Error(res.error || "Failed to clear");
      toast("success", `Cleared ${res.count} order${res.count !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast("error", e.message || "Clear failed");
    } finally {
      setIsClearingOrders(false);
      setTimeout(() => setTradeResult(p => p && Date.now() - p.id > 1000 ? null : p), 2500);
    }
  };

  const handleTargetTrade = async (side: "yes" | "no", qtyLimit: number | null, priceCap: number, resting: boolean) => {
    if (isTrading) return;

    // Use total liquidity for "Target All", or the manual qty
    const qty = qtyLimit === null
      ? (side === "yes" ? targetYesLiq : targetNoLiq)
      : qtyLimit;

    if (qty <= 0) {
      console.log(`[DEBUG] No Liquidity for ${side}: 2c YesLiq=${targetYesLiq}, 2c NoLiq=${targetNoLiq}`);
      toast("error", `No ${side.toUpperCase()} liquidity available`);
      return;
    }

    setIsTrading(true);
    setTradeResult({
      type: "success",
      message: `${qtyLimit === null ? 'TARGETING ALL' : 'TARGETING ' + qty} ${side.toUpperCase()}...`,
      id: Date.now()
    });

    try {
      const res = await placeTradeAction(market.ticker, side, qty, priceCap, resting);
      if (!res.success) throw new Error(res.error || "Trade rejected");

      // Extract fill information from Kalshi response
      const order = res.data?.order;
      const fillCount = order?.fill_count_fp ? Math.round(parseFloat(order.fill_count_fp)) : 0;

      if (fillCount > 0) {
        toast("success", `FILLED ${fillCount} ${side.toUpperCase()} @ ${priceCap}¢`);
      } else {
        toast("error", `No liquidity @ ${priceCap}¢ (Canceled)`);
      }

      refresh();
    } catch (e: any) {
      toast("error", e.message || "Trade failed");
    } finally {
      setIsTrading(false);
      setTimeout(() => {
        setTradeResult(p => (p && Date.now() - p.id > 2000 ? null : p));
      }, 3000);
    }
  };

  // presets ────────────────────────────────────────────────────────────────────
  const QTY_PRESETS = [{ l: "50", v: 50 }, { l: "100", v: 100 }, { l: "1k", v: 1000 }, { l: "5k", v: 5000 }];
  const PRICE_PRESETS = [
    { l: "2¢", v: 2 }, { l: "10¢", v: 10 }, { l: "25¢", v: 25 }, { l: "50¢", v: 50 },
    { l: "66¢", v: 66 }, { l: "81¢", v: 81 }, { l: "90¢", v: 90 }
  ];
  const TRADE_PRESETS = [100, 500, 1000, 5000];

  const fmtQty = (n: number | null) =>
    n == null ? "Max" : n >= 1000 ? `${n / 1000}k` : String(n);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full min-w-0 bg-[#090909] border border-[#334155] border-2 rounded-xl shadow-2xl flex flex-col overflow-visible animate-in fade-in duration-300">

      {/* X BUTTON */}
      {onRemove && (
        <button
          onClick={() => onRemove(market.ticker)}
          title="Remove this strike"
          className="absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-500 hover:text-white hover:bg-rose-600 hover:border-rose-500 transition-all shadow"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      {/* ── INTEGRATED TITLE & COMPACT CONTROLS ────────────────────────────── */}
      <div className="bg-[#0c0c0c] border-b border-[#161616]">

        {/* Target Buttons at TOP */}
        <div className="grid grid-cols-2 gap-[2px] p-[2px] bg-[#080808] border-b border-white/5">
          {/* YES SIDE */}
          <div className="flex flex-col gap-[2px]">
            <button
              onClick={() => handleTargetTrade("yes", null, 2, false)}
              disabled={isTrading}
              className="h-[28px] bg-[#06180c] border border-emerald-500/30 hover:bg-emerald-600 hover:border-emerald-400 rounded text-[9px] font-bold text-emerald-400 hover:text-black transition-all flex items-center justify-between px-2 gap-1"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Target className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">YES ALL</span>
              </div>
              <span className="opacity-60 text-[7px] font-mono shrink-0">MAX</span>
            </button>
            <button
              onClick={() => handleTargetTrade("yes", targetQty, 2, false)}
              disabled={isTrading}
              className="h-[28px] bg-[#06180c] border border-emerald-500/30 hover:bg-emerald-600 hover:border-emerald-400 rounded text-[9px] font-bold text-emerald-400 hover:text-black transition-all flex items-center justify-between px-2 gap-1"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Target className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">YES {fmtQty(targetQty)}</span>
              </div>
              <span className="opacity-60 text-[7px] font-mono shrink-0">@ 2¢</span>
            </button>
          </div>

          {/* NO SIDE */}
          <div className="flex flex-col gap-[2px]">
            <button
              onClick={() => handleTargetTrade("no", null, 2, false)}
              disabled={isTrading}
              className="h-[28px] bg-[#180606] border border-rose-500/30 hover:bg-rose-600 hover:border-rose-400 rounded text-[9px] font-bold text-rose-400 hover:text-white transition-all flex items-center justify-between px-2 gap-1"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Target className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">NO ALL</span>
              </div>
              <span className="opacity-60 text-[7px] font-mono shrink-0">MAX</span>
            </button>
            <button
              onClick={() => handleTargetTrade("no", targetQty, 2, false)}
              disabled={isTrading}
              className="h-[28px] bg-[#180606] border border-rose-500/30 hover:bg-rose-600 hover:border-rose-400 rounded text-[9px] font-bold text-rose-400 hover:text-white transition-all flex items-center justify-between px-2 gap-1"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Target className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">NO {fmtQty(targetQty)}</span>
              </div>
              <span className="opacity-60 text-[7px] font-mono shrink-0">@ 2¢</span>
            </button>
          </div>
        </div>

        {/* Row 1: Event Title (if exists) */}
        {eventTitle && (
          <div className="px-2 pt-1.5 text-[8.5px] font-bold uppercase text-blue-400/60 tracking-wider truncate">
            {eventTitle}
          </div>
        )}

        {/* Row 2: Title + Main Inputs */}
        <div className="px-2 py-1.5 flex items-center gap-2">
          {/* Title & Ticker */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[11px] font-bold text-gray-100 leading-tight line-clamp-2">
              {displayTitle}
            </div>
            <div className="text-[8px] text-gray-700 font-mono mt-0.5 truncate uppercase">
              {market.ticker}
            </div>
          </div>

          {/* Inputs Column */}
          <div className="flex flex-col gap-1 shrink-0 w-[110px]">
            {/* Qty Input Row */}
            <div className="flex items-center bg-[#111] border border-[#252525] rounded h-[18px] px-1 gap-1">
              <span className="text-[6.5px] text-gray-600 font-bold uppercase shrink-0">Qty</span>
              <input
                type="number" placeholder="mkt"
                className="flex-1 w-0 bg-transparent text-[9px] font-mono text-white text-right focus:outline-none"
                value={targetQty || ""}
                onChange={(e) => setTargetQty(parseInt(e.target.value) || null)}
              />
              <button
                onClick={() => setTargetQty(null)}
                className={`text-[7.5px] font-bold font-mono uppercase pl-0.5 border-l border-white/5 ${targetQty === null ? "text-blue-400" : "text-gray-700"}`}
              >MAX</button>
            </div>
            {/* Cap Input Row */}
            <div className="flex items-center bg-[#111] border border-[#252525] rounded h-[18px] px-1 gap-1">
              <span className="text-[6.5px] text-gray-600 font-bold uppercase shrink-0">Cap</span>
              <input
                type="number" placeholder="99" min="1" max="99"
                className="flex-1 w-0 bg-transparent text-[9px] font-mono text-white text-right focus:outline-none"
                value={targetPrice || ""}
                onChange={(e) => setTargetPrice(parseInt(e.target.value) || null)}
              />
              <button
                onClick={() => setTargetPrice(null)}
                className={`text-[7.5px] font-bold font-mono uppercase pl-0.5 border-l border-white/5 ${targetPrice === null ? "text-blue-400" : "text-gray-700"}`}
              >MAX</button>
            </div>
          </div>
        </div>

        {/* Row 3: Presets & Secondary Controls */}
        <div className="px-2 pb-2 flex flex-col gap-1.5">
          {/* Qty Presets */}
          <div className="flex gap-[2px]">
            {QTY_PRESETS.map(({ l, v }) => (
              <Chip key={`qp-${v}`} label={l} active={targetQty === v} onClick={() => setTargetQty(v)} />
            ))}
          </div>

          <div className="h-[0.4px] bg-white/50 w-full" />

          {/* Price Presets */}
          <div className="grid grid-cols-4 gap-[2px]">
            {PRICE_PRESETS.map(({ l, v }) => (
              <Chip key={`pp-${v}`} label={l} active={targetPrice === v} onClick={() => setTargetPrice(v)} />
            ))}
          </div>
          {/* Resting & Clear ALL */}
          <div className="flex items-center justify-between pt-0.5 border-t border-white/5">
            <label className="flex items-center gap-1 cursor-pointer group">
              <input type="checkbox" checked={isResting} onChange={(e) => setIsResting(e.target.checked)} className="w-2.5 h-2.5 accent-emerald-500 rounded" />
              <span className="text-[7.5px] text-gray-500 group-hover:text-gray-400 font-bold uppercase tracking-tight">Resting</span>
            </label>
            <button
              onClick={handleClearResting}
              disabled={isClearingOrders}
              className="text-[7.5px] text-rose-500/70 hover:text-rose-400 font-bold uppercase tracking-tight"
            >Clear All</button>
          </div>
        </div>
      </div>

      {/* ── CURRENT POSITION ────────────────────────────────────────────────── */}
      {(externalPosition || (position && position.count !== 0)) && (
        <div className="mx-2 mt-2 px-3 py-2 bg-[#0a0a0a] border border-blue-500/20 rounded-lg flex items-center justify-between animate-in zoom-in-95 duration-200">
          <div className="flex flex-col">
            <span className="text-[7px] font-bold uppercase text-blue-500/60 tracking-widest leading-none mb-1">Current Holding</span>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black uppercase ${(externalPosition?.side || position?.side) === 'yes' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(externalPosition?.side || position?.side)?.toUpperCase()}
              </span>
              <span className="text-[11px] font-mono font-bold text-gray-100">
                {(externalPosition?.count || position?.count)} contracts
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[7px] font-bold uppercase text-gray-500 tracking-widest block mb-0.5">Avg Price</span>
            <span className="text-[11px] font-mono font-bold text-gray-100">
              {(externalPosition?.price ?? position?.price ?? 0).toFixed(3)}¢
            </span>
          </div>
        </div>
      )}

      {/* ── BEST PRICE PILLS ───────────────────────────────────────────────── */}
      <div className="flex justify-center gap-3 px-2 pt-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#06180c] border border-emerald-900/30 min-w-[55px] justify-center">
          <span className="text-[7px] font-bold uppercase text-emerald-700 tracking-widest leading-none">YES</span>
          <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums leading-none">
            {bestYesPrice != null ? `${bestYesPrice}¢` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#180606] border border-rose-900/30 min-w-[55px] justify-center">
          <span className="text-[7px] font-bold uppercase text-rose-700 tracking-widest leading-none">NO</span>
          <span className="text-[11px] font-mono font-bold text-rose-400 tabular-nums leading-none">
            {bestNoPrice != null ? `${bestNoPrice}¢` : "—"}
          </span>
        </div>
      </div>

      {/* ── ORDER BOOK ─────────────────────────────────────────────────────── */}
      <div className="px-2 pt-1.5 pb-1 relative">
        <OrderBookLadder rawYes={orderbook.yes} rawNo={orderbook.no} />
        {/* Toast overlay */}
        {tradeResult && (
          <div
            key={tradeResult.id}
            className={`absolute inset-x-1.5 top-1.5 z-20 flex items-center gap-1 px-2 py-1 rounded-lg border backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-150 ${tradeResult.type === "success"
              ? "bg-[#06180c]/95 border-emerald-600/40"
              : "bg-[#180606]/95 border-rose-600/40"
              }`}
          >
            {tradeResult.type === "success"
              ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              : <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
            <span className={`text-[9px] font-bold font-mono truncate ${tradeResult.type === "success" ? "text-emerald-200" : "text-rose-200"
              }`}>
              {tradeResult.message}
            </span>
          </div>
        )}
      </div>

      {/* ── BUY BUTTONS ────────────────────────────────────────────────────── */}

      {/* ── BUY BUTTONS ────────────────────────────────────────────────────── */}
      <div className="px-2 pb-2.5 flex flex-col gap-[3px]">
        {/* Main YES / NO */}
        <div className="grid grid-cols-2 gap-[3px]">
          <button
            onClick={() => handleTrade("yes")}
            disabled={isTrading || (!isResting && !bestYesPrice)}
            className="group py-2 bg-[#06180c] border border-emerald-900/40 hover:bg-emerald-500 hover:border-emerald-400 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-[8px] font-bold uppercase text-emerald-500 group-hover:text-black tracking-wider block">
              {fmtQty(targetQty)} YES
            </span>
          </button>
          <button
            onClick={() => handleTrade("no")}
            disabled={isTrading || (!isResting && !bestNoPrice)}
            className="group py-2 bg-[#180606] border border-rose-900/40 hover:bg-rose-500 hover:border-rose-400 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-[8px] font-bold uppercase text-rose-500 group-hover:text-white tracking-wider block">
              {fmtQty(targetQty)} NO
            </span>
          </button>
        </div>

        {/* Quick qty preset buttons — YES left, NO right, 2 rows each */}
        <div className="grid grid-cols-2 gap-[3px]">
          {/* YES presets */}
          <div className="flex flex-col gap-[2px]">
            <div className="flex gap-[2px]">
              {TRADE_PRESETS.slice(0, 2).map((q) => (
                <button
                  key={`yes-${q}`}
                  onClick={() => handleTrade("yes", q)}
                  disabled={isTrading || (!isResting && !bestYesPrice)}
                  className="flex-1 py-1 bg-[#06180c] border border-emerald-900/30 hover:bg-emerald-600 hover:border-emerald-500 rounded text-[8px] font-mono font-bold text-emerald-600 hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {TRADE_PRESETS.slice(2, 4).map((q) => (
                <button
                  key={`yes-${q}`}
                  onClick={() => handleTrade("yes", q)}
                  disabled={isTrading || (!isResting && !bestYesPrice)}
                  className="flex-1 py-1 bg-[#06180c] border border-emerald-900/30 hover:bg-emerald-600 hover:border-emerald-500 rounded text-[8px] font-mono font-bold text-emerald-600 hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
          </div>
          {/* NO presets */}
          <div className="flex flex-col gap-[2px]">
            <div className="flex gap-[2px]">
              {TRADE_PRESETS.slice(0, 2).map((q) => (
                <button
                  key={`no-${q}`}
                  onClick={() => handleTrade("no", q)}
                  disabled={isTrading || (!isResting && !bestNoPrice)}
                  className="flex-1 py-1 bg-[#180606] border border-rose-900/30 hover:bg-rose-600 hover:border-rose-500 rounded text-[8px] font-mono font-bold text-rose-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {TRADE_PRESETS.slice(2, 4).map((q) => (
                <button
                  key={`no-${q}`}
                  onClick={() => handleTrade("no", q)}
                  disabled={isTrading || (!isResting && !bestNoPrice)}
                  className="flex-1 py-1 bg-[#180606] border border-rose-900/30 hover:bg-rose-600 hover:border-rose-500 rounded text-[8px] font-mono font-bold text-rose-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOCKING LOADER ────────────────────────────────────────────────── */}

    </div>
  );
};

// Custom comparison for memoization
const areEqual = (prev: any, next: any) => {
  if (prev.market.ticker !== next.market.ticker) return false;
  if (prev.eventTitle !== next.eventTitle) return false;
  if (prev.noPoll !== next.noPoll) return false;

  // Compare positions
  if (JSON.stringify(prev.externalPosition) !== JSON.stringify(next.externalPosition)) return false;

  // Deep compare externalOrderbook
  if (!prev.externalOrderbook && !next.externalOrderbook) return true;
  if (!prev.externalOrderbook || !next.externalOrderbook) return false;

  // Simple check for price/qty changes
  return (
    JSON.stringify(prev.externalOrderbook.yes) === JSON.stringify(next.externalOrderbook.yes) &&
    JSON.stringify(prev.externalOrderbook.no) === JSON.stringify(next.externalOrderbook.no)
  );
};

export default memo(MarketCardComponent, areEqual);
