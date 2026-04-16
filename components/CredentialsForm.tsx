"use client";

import React, { useState } from "react";
import { setKalshiCredentials } from "@/app/actions";
import { Loader2, ShieldCheck, Zap, CheckCircle2, AlertTriangle } from "lucide-react";

export default function CredentialsForm() {
  const [apiKey, setApiKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [environment, setEnvironment] = useState<"demo" | "real">("demo");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    try {
      // Pass environment to your server action
      await setKalshiCredentials(apiKey, privateKey, environment); 
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      
      {/* --- ENVIRONMENT SELECTOR --- */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest px-1">
          Trading Environment
        </label>
        <div className="grid grid-cols-2 p-1 bg-[#0a0a0a] border border-[#262626] rounded-lg">
          {(["demo", "real"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEnvironment(mode)}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
                environment === mode
                  ? mode === "real"
                    ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    : "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {mode === "real" ? <Zap className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {mode}
            </button>
          ))}
        </div>
        {environment === "real" && (
          <div className="flex items-center gap-2 px-1 text-amber-500/80 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-tighter">Warning: Real money will be used</span>
          </div>
        )}
      </div>

      {/* --- API KEY --- */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest px-1">
          Kalshi API Key
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-700"
          placeholder="e.g. 794ae40f-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          required
        />
      </div>

      {/* --- PRIVATE KEY --- */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest px-1">
          Private Key (PEM)
        </label>
        <textarea
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          rows={5}
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-[11px] font-mono text-gray-400 focus:outline-none focus:border-blue-500/50 transition-colors resize-none placeholder:text-gray-700"
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
          required
        />
      </div>

      {/* --- SUBMIT BUTTON --- */}
      <button
        type="submit"
        disabled={status === "loading"}
        className={`w-full mt-2 py-3 font-black uppercase tracking-widest text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] ${
          status === "loading"
            ? "bg-[#1a1a1a] text-gray-600 cursor-not-allowed"
            : status === "success"
            ? "bg-emerald-500 text-black"
            : environment === "real"
            ? "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-900/20"
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
        }`}
      >
        {status === "loading" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === "success" ? (
          <><CheckCircle2 className="w-4 h-4" /> Credentials Saved</>
        ) : (
          `Set ${environment.toUpperCase()} Keys`
        )}
      </button>

      {status === "error" && (
        <p className="text-center text-rose-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
          Connection Failed
        </p>
      )}
    </form>
  );
}