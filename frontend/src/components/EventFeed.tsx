"use client";

import React from "react";
import { truncateAddress, formatXLM } from "@/lib/stellar";

export interface ContractEvent {
  id: string;
  type: "mint" | "transfer" | "list" | "sale" | "delist";
  nftId: bigint;
  actor: string;
  price?: bigint;
  timestamp: number;
}

interface EventFeedProps {
  events: ContractEvent[];
  isLoading: boolean;
}

export default function EventFeed({ events, isLoading }: EventFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "mint": return "✦";
      case "transfer": return "↔";
      case "list": return "🏷";
      case "sale": return "✓";
      case "delist": return "✕";
      default: return "•";
    }
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="glass-card flex flex-col h-full min-h-[400px]">
      <div className="p-5 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-aura">Live Activity</h3>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-aura animate-pulse" />
          <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[460px] p-2 space-y-2 custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full rounded-xl opacity-20" />
          ))
        ) : events.length === 0 ? (
          <div className="h-full flex flex-center flex-col items-center justify-center p-12 text-center opacity-30">
            <span className="text-4xl mb-4">✦</span>
            <p className="text-sm">No activity yet.<br />Mint the first NFT!</p>
          </div>
        ) : (
          events.map((event) => (
            <div 
              key={event.id}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-border-subtle transition-all animate-[fadeInRight_0.4s_ease-out]"
            >
              {/* Type Icon */}
              <div className="w-10 h-10 rounded-full bg-bg-deep border border-border-subtle flex items-center justify-center text-aura-gold text-lg">
                {getIcon(event.type)}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-primary uppercase tracking-tight">
                    {event.type}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-aura/10 text-aura font-['JetBrains_Mono'] text-[9px] font-bold">
                    #{event.nftId.toString()}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted truncate">
                  {event.type === "mint" ? "Created by" : "By"} {truncateAddress(event.actor)}
                  {event.price && ` for ${formatXLM(event.price)} XLM`}
                </p>
              </div>

              {/* Time */}
              <div className="text-right">
                <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
                  {getTimeAgo(event.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
