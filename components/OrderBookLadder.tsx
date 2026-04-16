"use client";
import React, { useEffect, useState, useRef } from "react";

// --- ROW COMPONENT ---
const LadderRow = ({
  price,
  qty,
  type,
}: {
  price: number;
  qty: number;
  type: "bid" | "ask";
}) => {
  const [flashClass, setFlashClass] = useState("");
  const prevQtyRef = useRef(qty);

  useEffect(() => {
    if (prevQtyRef.current !== qty) {
      const color = type === "bid" ? "bg-emerald-500/20" : "bg-rose-500/20";
      setFlashClass(color);
      const timer = setTimeout(() => setFlashClass(""), 400);
      prevQtyRef.current = qty;
      return () => clearTimeout(timer);
    }
  }, [qty, type]);

  return (
    <div
      className={`flex justify-between items-center h-7 px-3 rounded transition-colors duration-300 ${flashClass} hover:bg-white/5`}
    >
      <span
        className={`text-[16px] font-mono font-bold ${type === "bid" ? "text-emerald-500" : "text-rose-500"}`}
      >
        {price}¢
      </span>
      <span className="text-[16px] font-mono text-gray-400">{qty}</span>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function OrderBookLadder({
  rawYes,
  rawNo,
}: {
  rawYes: [number, number][];
  rawNo: [number, number][];
}) {
    const yesBids = [...rawYes].sort((a, b) => b[0] - a[0]).slice(0, 5);

    const yesAsks = rawNo
    .map(([p, q]): [number, number] => [100 - p, q])
    .sort((a, b) => b[0] - a[0]) 
    .slice(0, 5); 

  console.log("Current Ask Order:", yesAsks.map(a => a[0]));

  const renderSection = (
    title: string,
    bids: [number, number][],
    asks: [number, number][],
  ) => (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold uppercase text-gray-500 px-1 tracking-widest">
        {title} Contract
      </div>

      <div className="grid grid-cols-2 gap-1 bg-[#1a1a1a] border border-[#262626] rounded-lg overflow-hidden p-[1px]">
        {/* BIDS (Left) - Declining ¢ */}
        <div className="bg-[#0f0f0f] flex flex-col">
          <div className="flex justify-between px-3 py-2 bg-[#161616] border-b border-[#222]">
            <span className="text-[14px] text-gray-500 font-bold uppercase tracking-wider">
              Bid
            </span>
            <span className="text-[14px] text-gray-500 font-bold uppercase tracking-wider">
              Qty
            </span>
          </div>
          <div className="py-1">
            {bids.map(([p, q]) => (
              <LadderRow key={`b-${title}-${p}`} price={p} qty={q} type="bid" />
            ))}
            {bids.length === 0 && (
              <div className="h-7 flex items-center justify-center text-gray-800 text-xs italic">
                Empty
              </div>
            )}
          </div>
        </div>

        {/* ASKS (Right) - Increasing ¢ */}
        <div className="bg-[#0f0f0f] flex flex-col">
          <div className="flex justify-between px-3 py-2 bg-[#161616] border-b border-[#222]">
            <span className="text-[14px] text-gray-500 font-bold uppercase tracking-wider">
              Ask
            </span>
            <span className="text-[14px] text-gray-500 font-bold uppercase tracking-wider">
              Qty
            </span>
          </div>
          <div className="py-1 flex flex-col-reverse">
            {asks.map(([p, q]) => (
              <LadderRow key={`a-${title}-${p}`} price={p} qty={q} type="ask" />
            ))}
            {asks.length === 0 && (
              <div className="h-7 flex items-center justify-center text-gray-800 text-xs italic">
                Empty
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {renderSection("Yes", yesBids, yesAsks)}
    </div>
  );
}
