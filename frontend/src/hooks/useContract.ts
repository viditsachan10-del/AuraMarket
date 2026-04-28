"use client";

import useSWR from "swr";
import {
  getTotalSupply,
  getActiveListings,
  getListing,
  getNft,
  getOwnerNfts,
  fetchRecentEvents,
  type NftMetadata,
  type Listing,
  type ContractEvent,
} from "@/lib/stellar";

// ── Total supply (poll every 10 s) ────────────────────────────────────────────

export function useTotalSupply() {
  return useSWR("total_supply", getTotalSupply, {
    refreshInterval: 10_000,
    revalidateOnFocus: true,
  });
}

// ── Active listings (poll every 8 s) ──────────────────────────────────────────

export function useActiveListings() {
  return useSWR<number[]>("active_listings", getActiveListings, {
    refreshInterval: 8_000,
    revalidateOnFocus: true,
  });
}

// ── Single listing ────────────────────────────────────────────────────────────

export function useListing(nftId: number | null) {
  return useSWR<Listing | null>(
    nftId !== null ? `listing_${nftId}` : null,
    () => getListing(nftId!),
    { refreshInterval: 10_000 }
  );
}

// ── Single NFT metadata ───────────────────────────────────────────────────────

export function useNft(id: number | null) {
  return useSWR<NftMetadata | null>(
    id !== null ? `nft_${id}` : null,
    () => getNft(id!),
    { refreshInterval: 15_000 }
  );
}

// ── Owner NFTs ────────────────────────────────────────────────────────────────

export function useOwnerNfts(owner: string | null) {
  return useSWR<number[]>(
    owner ? `owner_nfts_${owner}` : null,
    () => getOwnerNfts(owner!),
    { refreshInterval: 10_000, revalidateOnFocus: true }
  );
}

// ── Live event feed (poll every 5 s) ─────────────────────────────────────────

export function useEventFeed() {
  return useSWR<ContractEvent[]>("events", fetchRecentEvents, {
    refreshInterval: 5_000,
    revalidateOnFocus: true,
  });
}
