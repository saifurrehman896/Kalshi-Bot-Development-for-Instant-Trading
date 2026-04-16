"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Flame, TrendingUp, Zap, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useUI } from '@/context/UIContext';
import { setKalshiCredentials } from '@/app/actions';

const CATEGORIES = ["Politics", "Sports", "Economics", "Culture", "Crypto", "Science", "Companies"];

export default function Header() {
  const { selectedCategory, setSelectedCategory } = useUI();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [environment, setEnvironment] = useState<"demo" | "real">("demo");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Only passing environment now
      await setKalshiCredentials(environment);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setIsModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error("Failed to save environment preference", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <header className="border-b border-gray-800 bg-background/80 backdrop-blur-md sticky top-0 z-50 h-[65px] flex items-center">
        <div className="container mx-auto max-w-7xl flex items-center justify-between px-6">
          
          <Link href="/" className="flex items-center gap-2 mr-8 group">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center group-hover:rotate-3 transition-transform">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tighter text-white hidden sm:block">PREDICT</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-hide">
             {/* Trending Button and Categories... (Keep existing logic) */}
             {CATEGORIES.map((cat) => (
               <button 
                 key={cat} 
                 onClick={() => setSelectedCategory(cat)}
                 className={`px-4 py-2 text-sm font-medium rounded-full shrink-0 transition-all ${selectedCategory === cat ? "bg-white text-black" : "text-subtext hover:text-white"}`}
               >
                 {cat}
               </button>
             ))}
          </nav>

          <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-800 shrink-0">
             <Link

              href="/quick-trade"

              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />

              <span className="hidden md:inline">Quick Trade</span>

            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-8 h-8 rounded-full bg-surface border border-gray-700 flex items-center justify-center group"
              title="Switch Environment"
            >
              <Key className="w-3.5 h-3.5 text-subtext group-hover:text-accent transition-colors" />
            </button>
          </div>
        </div>
      </header>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="bg-background border border-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Kalshi Settings</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">Using keys from .env.local</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest ml-1">Select Environment</label>
                <div className="grid grid-cols-2 p-1 bg-surface border border-gray-800 rounded-lg">
                  {(["demo", "real"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEnvironment(mode)}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-all ${
                        environment === mode
                          ? mode === "real" ? "bg-amber-500 text-black shadow-lg" : "bg-blue-600 text-white shadow-lg"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {mode === "real" ? <Zap className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-[11px] text-blue-400 leading-relaxed">
                  <strong>Note:</strong> API keys are now pulled securely from your server environment. This toggle only changes which Kalshi API endpoint the app communicates with.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full py-3 font-bold rounded-lg transition-all ${
                  isSaved ? "bg-emerald-500 text-black" : "bg-accent text-black hover:bg-accent/90"
                }`}
              >
                {isSaving ? "Updating..." : isSaved ? "Preference Saved!" : `Switch to ${environment.toUpperCase()}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}