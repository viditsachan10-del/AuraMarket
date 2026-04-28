"use client";

import useSWR from "swr";
import {
  getTotalSupply,
  getActiveListings,
  getListing,
  getNFT,
  getOwnerNFTs,
  type NFTMetadata,
  type Listing,
} from "@/lib/contracts";

// ── Total supply (poll every 10 s) ────────────────────────────────────────────

export function useTotalSupply() {
  return useSWR("total_supply", getTotalSupply, {
    refreshInterval: 10_000,
    revalidateOnFocus: true,
  });
}

// ── Active listings (poll every 8 s) ──────────────────────────────────────────

export function useActiveListings() {
  return useSWR<bigint[]>("active_listings", getActiveListings, {
    refreshInterval: 8_000,
    revalidateOnFocus: true,
  });
}

// ── Single listing ────────────────────────────────────────────────────────────

export function useListing(nftId: bigint | null) {
  return useSWR<Listing | null>(
    nftId !== null ? `listing_${nftId}` : null,
    () => getListing(nftId!),
    { refreshInterval: 10_000 }
  );
}

// ── Single NFT metadata ───────────────────────────────────────────────────────

export function useNft(id: bigint | null) {
  return useSWR<NFTMetadata | null>(
    id !== null ? `nft_${id}` : null,
    () => getNFT(id!),
    { refreshInterval: 15_000 }
  );
}

// ── Owner NFTs ────────────────────────────────────────────────────────────────

export function useOwnerNfts(owner: string | null) {
  return useSWR<bigint[]>(
    owner ? `owner_nfts_${owner}` : null,
    () => getOwnerNFTs(owner!),
    { refreshInterval: 10_000, revalidateOnFocus: true }
  );
}
