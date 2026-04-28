"use client";

import React, { useState } from "react";
import { NFTMetadata, Listing } from "@/lib/contracts";
import { truncateAddress, formatXLM } from "@/lib/stellar";

interface NFTCardProps {
  nft: NFTMetadata;
  listing?: Listing;
  onBuy?: () => void;
  onList?: () => void;
  onDelist?: () => void;
  isOwner: boolean;
  isBuying?: boolean;
}

export default function NFTCard({
  nft,
  listing,
  onBuy,
  onList,
  onDelist,
  isOwner,
  isBuying = false,
}: NFTCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  // Deterministic gradient based on ID
  const generateGradient = (id: bigint) => {
    const hue1 = Number(id * BigInt(137)) % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 20%), hsl(${hue2}, 60%, 10%))`;
  };

  const hasValidImage = nft.imageUrl && nft.imageUrl.startsWith("https://");

  return (
    <div className="glass-card group relative flex flex-col overflow-hidden w-full max-w-[340px]">
      {/* Badge: Yours */}
      {isOwner && (
        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-aura/20 backdrop-blur-md border border-aura/30">
          <span className="text-[10px] font-bold text-aura uppercase tracking-widest">Yours</span>
        </div>
      )}

      {/* Image Area */}
      <div className="relative aspect-square overflow-hidden bg-bg-deep">
        {!imgLoaded && <div className="skeleton absolute inset-0 z-0" />}
        
        {hasValidImage ? (
          <img
            src={nft.imageUrl}
            alt={nft.name}
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center p-8 transition-transform duration-700 group-hover:scale-105"
            style={{ background: generateGradient(nft.id) }}
          >
            <span className="text-6xl opacity-20 filter grayscale">✦</span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          {listing && !isOwner && (
            <button
              onClick={onBuy}
              disabled={isBuying}
              className="btn-aura px-8 py-3 scale-90 group-hover:scale-100 transition-transform"
            >
              {isBuying ? "Processing..." : "Purchase NFT"}
            </button>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-5 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-['Cormorant_Garamond'] text-xl text-primary truncate leading-none">
              {nft.name}
            </h3>
            <span className="font-['JetBrains_Mono'] text-xs text-aura">#{nft.id.toString()}</span>
          </div>
          <p className="font-['JetBrains_Mono'] text-[11px] text-text-muted">
            by <span className="text-text-secondary">{truncateAddress(nft.creator)}</span>
          </p>
        </div>

        {/* Action / Price Section */}
        <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
          {listing ? (
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-text-muted mb-0.5">Price</span>
              <span className="font-['JetBrains_Mono'] font-bold text-sm text-primary">
                {formatXLM(listing.priceXlm)} XLM
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-text-muted mb-0.5">Status</span>
              <span className="font-['DM_Sans'] text-xs text-text-secondary">Not Listed</span>
            </div>
          )}

          {isOwner ? (
            listing ? (
              <button onClick={onDelist} className="btn-ghost !px-4 !py-2 !text-[10px]">
                Delist
              </button>
            ) : (
              <button onClick={onList} className="btn-ghost !px-4 !py-2 !text-[10px]">
                List for Sale
              </button>
            )
          ) : (
            listing && (
              <button 
                onClick={onBuy} 
                disabled={isBuying}
                className="btn-aura !px-4 !py-2 !text-[10px]"
              >
                {isBuying ? "..." : "Buy Now"}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
