"use client";

import React, { useState } from "react";
import { NFTMetadata } from "@/lib/contracts";

interface ListingModalProps {
  nft: NFTMetadata;
  onList: (price: number) => void;
  onClose: () => void;
  isListing: boolean;
}

export default function ListingModal({
  nft,
  onList,
  onClose,
  isListing,
}: ListingModalProps) {
  const [price, setPrice] = useState<string>("10");
  
  const numericPrice = parseFloat(price) || 0;
  const protocolFee = numericPrice * 0.025;
  const netAmount = Math.max(0, numericPrice - protocolFee);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericPrice >= 1) {
      onList(numericPrice);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-bg-void/80 backdrop-blur-md"
        onClick={!isListing ? onClose : undefined}
      />
      
      {/* Modal Content */}
      <div className="glass-card relative z-10 w-full max-w-md p-8 animate-[scaleIn_0.3s_ease-out]">
        <div className="mb-8 text-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-aura font-bold mb-2 block">
            Marketplace Listing
          </span>
          <h2 className="text-3xl font-['Cormorant_Garamond'] mb-1">{nft.name}</h2>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">ID: #{nft.id.toString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold block text-center">
              Set your asking price
            </label>
            
            <div className="relative flex items-center justify-center">
              <input
                type="number"
                step="0.1"
                min="1"
                required
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-transparent text-center text-5xl font-['JetBrains_Mono'] font-bold text-primary focus:outline-none w-full placeholder:text-text-muted/20"
                placeholder="0.00"
              />
              <span className="absolute right-0 bottom-2 text-aura font-bold tracking-widest">XLM</span>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-border-aura to-transparent" />
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-3 px-4 py-4 rounded-xl bg-bg-deep/50 border border-border-subtle">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Protocol fee (2.5%)</span>
              <span className="text-text-secondary font-['JetBrains_Mono']">
                -{protocolFee.toFixed(2)} XLM
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-text-secondary">You receive</span>
              <span className="text-aura-gold font-['JetBrains_Mono']">
                {netAmount.toFixed(2)} XLM
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isListing || numericPrice < 1}
              className="btn-aura w-full h-[52px]"
            >
              {isListing ? "Processing..." : `List for ${numericPrice} XLM`}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isListing}
              className="btn-ghost w-full h-[52px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
