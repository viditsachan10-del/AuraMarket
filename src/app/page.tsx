"use client";

import React, { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/components/Toast";
import useScrollReveal from "@/hooks/useScrollReveal";
import { 
  getTotalSupply, 
  getNFT, 
  getActiveListings, 
  getListing, 
  getOwnerNFTs,
  NFTMetadata,
  Listing,
  buyNFT,
  listNFT,
  delistNFT,
  transferNFT,
  addNFTContractToFreighter
} from "@/lib/contracts";
import { 
  NFT_CONTRACT_ID, 
  MARKETPLACE_CONTRACT_ID, 
  truncateAddress, 
  getServer 
} from "@/lib/stellar";
import { rpc as SorobanRpc, scValToNative } from "@stellar/stellar-sdk";

import NFTCard from "@/components/NFTCard";
import MintForm from "@/components/MintForm";
import ListingModal from "@/components/ListingModal";
import EventFeed, { ContractEvent } from "@/components/EventFeed";

export default function AuraMarketPage() {
  useScrollReveal();
  const { address, isConnected, connect, signAndSubmit } = useWallet();
  const { addToast } = useToast();

  const [isMinting, setIsMinting] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // NFT ID being processed
  const [listingModalNFT, setListingModalNFT] = useState<NFTMetadata & { id: bigint } | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("auramarket_legacy_cleanup_done")) {
      setShowCleanup(true);
    }
  }, []);

  const handleManualAddFreighter = async () => {
    try {
      await addNFTContractToFreighter();
      addToast("success", `✦ NFT contract added to Freighter!`);
    } catch (e: any) {
      if (e.message === "COPIED_FALLBACK") {
        addToast("success", `Contract ID copied! In Freighter: Menu → Manage Assets → Add → Paste`);
      } else {
        addToast("error", "Failed to add token to Freighter");
      }
    }
  };

  const dismissCleanup = () => {
    localStorage.setItem("auramarket_legacy_cleanup_done", "true");
    setShowCleanup(false);
  };
  const [transferData, setTransferData] = useState({ id: "", recipient: "" });

  // ── Data Fetching (SWR) ────────────────────────────────────────────────────

  // 1. Total Supply
  const { data: totalSupply = BigInt(0), mutate: mutateSupply } = useSWR(
    "total-supply",
    () => getTotalSupply(),
    { refreshInterval: 10000 }
  );

  // 2. All NFTs (calculated from supply)
  const { data: nfts = [], isLoading: isLoadingNfts } = useSWR(
    totalSupply > 0 ? `nfts-${totalSupply.toString()}` : null,
    async () => {
      const promises = [];
      for (let i = 1; i <= Number(totalSupply); i++) {
        promises.push(getNFT(BigInt(i)));
      }
      return Promise.all(promises);
    },
    { refreshInterval: 15000 }
  );

  // 3. Active Listings
  const { data: activeListings = [], mutate: mutateListings } = useSWR(
    "active-listings",
    async () => {
      const ids = await getActiveListings();
      const promises = ids.map(id => getListing(id));
      return Promise.all(promises);
    },
    { refreshInterval: 15000 }
  );

  // 4. User Portfolio
  const { data: userNftIds = [] } = useSWR(
    isConnected && address ? `user-nfts-${address}` : null,
    () => getOwnerNFTs(address!),
    { refreshInterval: 15000 }
  );

  // 5. Activity Feed
  const { data: events = [], isLoading: isLoadingEvents } = useSWR(
    "protocol-events",
    async () => {
      const server = getServer();
      const result = await server.getEvents({
        startLedger: 0,
        filters: [{ type: "contract", contractIds: [NFT_CONTRACT_ID, MARKETPLACE_CONTRACT_ID].filter(Boolean) }],
        limit: 20,
      });
      
      return result.events.map(e => ({
        id: e.id,
        type: (scValToNative(e.topic[0])?.toString() || "unknown") as any,
        nftId: BigInt(scValToNative(e.topic[1] || "0")),
        actor: scValToNative(e.value), // Simplification: actual schema may vary
        timestamp: Date.now(), // Real apps use ledger timestamps
      })).reverse();
    },
    { refreshInterval: 8000 }
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBuy = async (nftId: bigint) => {
    if (!address) return connect();
    setIsProcessing(nftId.toString());
    try {
      const xdr = await buyNFT(address, nftId);
      await signAndSubmit(xdr);
      addToast("success", "Purchase successful! NFT transferred to your wallet.");
      mutateListings();
    } catch (err: any) {
      addToast("error", err.message || "Failed to buy NFT");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleList = async (price: number) => {
    if (!listingModalNFT || !address) return;
    setIsProcessing(listingModalNFT.id.toString());
    try {
      const xdr = await listNFT(address, listingModalNFT.id, price);
      await signAndSubmit(xdr);
      addToast("success", `NFT #${listingModalNFT.id} is now listed for ${price} XLM`);
      setListingModalNFT(null);
      mutateListings();
    } catch (err: any) {
      addToast("error", err.message || "Failed to list NFT");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelist = async (nftId: bigint) => {
    if (!address) return;
    setIsProcessing(nftId.toString());
    try {
      const xdr = await delistNFT(address, nftId);
      await signAndSubmit(xdr);
      addToast("success", "NFT delisted successfully.");
      mutateListings();
    } catch (err: any) {
      addToast("error", err.message || "Failed to delist NFT");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !transferData.id || !transferData.recipient) return;
    setIsProcessing("transfer");
    try {
      const xdr = await transferNFT(address, transferData.recipient, BigInt(transferData.id));
      await signAndSubmit(xdr);
      addToast("success", `NFT #${transferData.id} transferred to ${truncateAddress(transferData.recipient)}`);
      setTransferData({ id: "", recipient: "" });
    } catch (err: any) {
      addToast("error", err.message || "Transfer failed");
    } finally {
      setIsProcessing(null);
    }
  };

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const findListing = (id: bigint) => activeListings.find(l => l.nftId === id);

  return (
    <div className="min-h-screen">
      {/* SECTION 1: HERO (id="hero") */}
      <section id="hero" className="relative h-screen flex items-center justify-center overflow-hidden pt-18">
        {/* Orbs */}
        <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-radial-gradient from-aura/10 to-transparent blur-[100px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-radial-gradient from-purple-500/10 to-transparent blur-[80px] opacity-15 pointer-events-none" />
        
        {/* Dot Grid */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(rgba(232,168,124,0.15) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="container relative z-10 mx-auto px-4 md:px-6 text-center max-w-[800px]">
          <div className="flex justify-center mb-6 reveal" data-delay="0">
            <div className="px-4 py-1.5 rounded-full border border-border-aura bg-bg-glass text-[11px] font-['JetBrains_Mono'] text-aura tracking-widest uppercase">
              ✦ On Stellar Soroban · Testnet
            </div>
          </div>
          
          <h1 className="font-['Cormorant_Garamond'] text-[36px] leading-tight md:text-8xl font-extrabold mb-2 reveal" data-delay="100">
            <span className="bg-gradient-to-r from-text-primary to-aura bg-clip-text text-transparent">Own the Moment.</span>
          </h1>
          <h1 className="font-['Cormorant_Garamond'] text-[28px] leading-tight md:text-7xl font-bold opacity-60 mb-8 reveal" data-delay="150">
            Trade the Story.
          </h1>
          
          <p className="text-text-secondary text-base md:text-xl mb-12 max-w-2xl mx-auto reveal" data-delay="200">
            AuraMarket is an NFT minting and trading platform built entirely on Stellar Soroban smart contracts. 
            Collect rare digital assets with the speed and security of the Stellar network.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 reveal" data-delay="300">
            <a href="#mint" className="btn-aura w-full sm:min-w-[180px]">Start Minting ↓</a>
            <a href="#marketplace" className="btn-ghost w-full sm:min-w-[180px]">Explore Market ↓</a>
          </div>

          <div className="mt-20 flex flex-wrap justify-center gap-8 reveal" data-delay="400">
            {["✦ NFT Contract Deployed", "⚡ Inter-Contract Calls", "🌐 Stellar Testnet"].map(stat => (
              <div key={stat} className="px-6 py-2 rounded-full border border-border-subtle bg-white/5 text-[10px] uppercase tracking-widest font-bold text-text-muted">
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: GALLERY (id="gallery") */}
      <section id="gallery" className="py-24 border-t border-border-subtle bg-bg-deep/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <span className="text-[10px] text-aura font-bold tracking-[0.2em] uppercase mb-2 block">◈ ALL NFTS</span>
              <h2 className="text-5xl font-['Cormorant_Garamond']">The Collection</h2>
              <p className="text-text-muted text-sm mt-2">Every NFT minted on AuraMarket, live from the blockchain.</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-muted uppercase tracking-widest block mb-1">Total Supply</span>
              <span className="text-3xl font-['JetBrains_Mono'] text-primary">{totalSupply.toString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {isLoadingNfts ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton aspect-square rounded-2xl opacity-20" />
              ))
            ) : nfts.length === 0 ? (
              <div className="col-span-full py-20 text-center glass-card border-dashed">
                <p className="text-text-muted">No NFTs minted yet. Be the first!</p>
                <a href="#mint" className="btn-aura mt-6 inline-block">Mint Now</a>
              </div>
            ) : (
              nfts.map(nft => (
                <NFTCard 
                  key={nft.id.toString()}
                  nft={nft}
                  listing={findListing(nft.id)}
                  isOwner={nft.owner === address}
                  onBuy={() => handleBuy(nft.id)}
                  onList={() => setListingModalNFT(nft)}
                  onDelist={() => handleDelist(nft.id)}
                  isBuying={isProcessing === nft.id.toString()}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: MINT (id="mint") */}
      <section id="mint" className="py-24 border-t border-border-subtle">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="text-[10px] text-aura font-bold tracking-[0.2em] uppercase mb-2 block">◈ CREATE</span>
            <h2 className="text-4xl md:text-5xl font-['Cormorant_Garamond']">Mint Your NFT</h2>
            <p className="text-text-muted text-sm mt-2">Immortalize your creation on the Stellar blockchain.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <MintForm 
              onSuccess={(_nftId: bigint) => mutateSupply()}
              walletAddress={address}
              onConnect={connect}
              isMinting={isMinting}
              setIsMinting={setIsMinting}
            />

            <div className="glass-card p-10 reveal" data-delay="100">
              <h3 className="text-xl mb-8 font-bold">How Minting Works</h3>
              <div className="space-y-10">
                {[
                  { n: "01", t: "Connect Wallet", d: "Link your Freighter wallet to authenticate on-chain." },
                  { n: "02", t: "Fill Details", d: "Provide a name, description, and secure image URL." },
                  { n: "03", t: "Sign & Mint", d: "Approve the Soroban transaction in your wallet." },
                  { n: "04", t: "It's On-Chain", d: "Your NFT appears in the gallery instantly for everyone." }
                ].map((step, idx) => (
                  <div key={idx} className="relative pl-12">
                    <span className="absolute left-0 top-0 text-4xl font-black text-aura/5 pointer-events-none select-none -translate-y-2">
                      {step.n}
                    </span>
                    <h4 className="text-sm font-bold text-aura-gold uppercase tracking-widest mb-1">{step.t}</h4>
                    <p className="text-sm text-text-muted leading-relaxed">{step.d}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12 pt-8 border-t border-border-subtle">
                <p className="text-[10px] text-text-muted uppercase tracking-widest text-center">
                  Estimated gas fee ~0.01 XLM on Stellar Testnet
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: MARKETPLACE (id="marketplace") */}
      <section id="marketplace" className="py-24 border-t border-border-subtle bg-bg-deep/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 text-center md:text-left">
            <span className="text-[10px] text-aura font-bold tracking-[0.2em] uppercase mb-2 block">◈ MARKET</span>
            <h2 className="text-4xl md:text-5xl font-['Cormorant_Garamond']">Buy & Sell</h2>
            <p className="text-text-muted text-sm mt-2">Browse listed NFTs and trade with other collectors.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {activeListings.length === 0 ? (
              <div className="col-span-full py-24 text-center glass-card border-dashed">
                <p className="text-text-muted text-lg">No NFTs listed for sale yet.</p>
                <p className="text-text-muted/40 text-sm mt-2">Own an NFT? List it to see it here!</p>
              </div>
            ) : (
              activeListings.map(listing => {
                const nft = nfts.find(n => n.id === listing.nftId);
                if (!nft) return null;
                return (
                  <NFTCard 
                    key={listing.nftId.toString()}
                    nft={nft}
                    listing={listing}
                    isOwner={nft.owner === address}
                    onBuy={() => handleBuy(nft.id)}
                    onList={() => setListingModalNFT(nft)}
                    onDelist={() => handleDelist(nft.id)}
                    isBuying={isProcessing === nft.id.toString()}
                  />
                );
              })
            )}
          </div>
          <p className="mt-12 text-center text-[10px] text-text-muted uppercase tracking-[0.2em]">
            2.5% protocol fee applied to all marketplace sales
          </p>
        </div>
      </section>

      {/* SECTION 5: PORTFOLIO (id="portfolio") */}
      <section id="portfolio" className="py-24 border-t border-border-subtle">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12">
            <span className="text-[10px] text-aura font-bold tracking-[0.2em] uppercase mb-2 block">◈ PORTFOLIO</span>
            <h2 className="text-4xl md:text-5xl font-['Cormorant_Garamond']">Your Collection</h2>
          </div>

          {!isConnected ? (
            <div className="max-w-2xl mx-auto py-20 text-center glass-card">
              <span className="text-4xl block mb-6">✦</span>
              <h3 className="text-xl mb-2">Connect your Freighter wallet</h3>
              <p className="text-text-muted text-sm mb-8">View and manage the NFTs you own in one place.</p>
              <button onClick={connect} className="btn-aura px-10">Connect Wallet</button>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="flex flex-wrap gap-6 items-center justify-between p-6 rounded-2xl bg-white/5 border border-border-subtle">
                <div>
                  <span className="text-[10px] text-text-muted uppercase tracking-widest block mb-1">Collecting as</span>
                  <span className="font-['JetBrains_Mono'] text-sm text-aura-gold">{address}</span>
                </div>
                <div className="flex gap-8">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-widest block mb-1">NFTs Owned</span>
                    <span className="text-xl font-bold">{userNftIds.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-widest block mb-1">Active Listings</span>
                    <span className="text-xl font-bold">{activeListings.filter(l => l.seller === address).length}</span>
                  </div>
                </div>
              </div>

              {showCleanup && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-aura-gold/10 border border-aura-gold/30 text-aura-gold">
                  <div className="mb-4 sm:mb-0">
                    <h4 className="font-bold text-sm mb-1">Legacy Token Cleanup</h4>
                    <p className="text-xs opacity-80">
                      If you hold old "NR..." tokens, please manually hide them in Freighter (Manage Assets → Hide). 
                      AuraMarket NFTs are now fully native and managed under a single unified Contract ID.
                    </p>
                  </div>
                  <button 
                    onClick={dismissCleanup}
                    className="shrink-0 px-4 py-2 border border-aura-gold/30 rounded-lg text-xs font-bold hover:bg-aura-gold/20 transition-colors"
                  >
                    Got it
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleManualAddFreighter}
                  className="text-xs px-4 py-2 rounded-lg bg-bg-void border border-border-subtle hover:border-aura transition-colors flex items-center gap-2"
                >
                  <span className="text-aura">✦</span>
                  Add AURA to Freighter
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {userNftIds.length === 0 ? (
                  <div className="col-span-full py-16 text-center opacity-30">
                    <p>You don't own any Auras yet.</p>
                  </div>
                ) : (
                  userNftIds.map(id => {
                    const nft = nfts.find(n => n.id === id);
                    if (!nft) return null;
                    return (
                      <NFTCard 
                        key={id.toString()}
                        nft={nft}
                        listing={findListing(id)}
                        isOwner={true}
                        onList={() => setListingModalNFT(nft)}
                        onDelist={() => handleDelist(id)}
                      />
                    );
                  })
                )}
              </div>

              {/* Transfer Form */}
              <div className="max-w-xl glass-card p-8">
                <h3 className="text-lg font-bold mb-4">Transfer an NFT</h3>
                <form onSubmit={handleTransfer} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <input 
                        type="number" 
                        placeholder="ID"
                        value={transferData.id}
                        onChange={(e) => setTransferData({ ...transferData, id: e.target.value })}
                        className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-aura outline-none" 
                      />
                    </div>
                    <div className="col-span-2">
                      <input 
                        type="text" 
                        placeholder="Recipient Address (G...)"
                        value={transferData.recipient}
                        onChange={(e) => setTransferData({ ...transferData, recipient: e.target.value })}
                        className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-aura outline-none" 
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isProcessing === "transfer"}
                    className="btn-ghost w-full py-3 text-xs"
                  >
                    {isProcessing === "transfer" ? "Transferring..." : "Transfer NFT →"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 6: ACTIVITY (id="activity") */}
      <section id="activity" className="py-24 border-t border-border-subtle bg-bg-deep/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12">
            <span className="text-[10px] text-aura font-bold tracking-[0.2em] uppercase mb-2 block">◈ LIVE FEED</span>
            <h2 className="text-4xl md:text-5xl font-['Cormorant_Garamond']">Protocol Activity</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <EventFeed events={events as any} isLoading={isLoadingEvents} />
            </div>
            
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6">Smart Contracts</h3>
                <div className="space-y-6">
                  {[
                    { name: "NFT Contract", addr: NFT_CONTRACT_ID },
                    { name: "Marketplace", addr: MARKETPLACE_CONTRACT_ID }
                  ].map(contract => (
                    <div key={contract.name} className="group cursor-pointer">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-text-secondary">{contract.name}</span>
                        <span className="text-[10px] text-aura font-['JetBrains_Mono']">✓ Active</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-bg-deep border border-border-subtle group-hover:border-aura transition-all overflow-hidden">
                        <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted truncate mr-4">
                          {contract.addr}
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(contract.addr);
                            addToast("info", "Address copied to clipboard");
                          }}
                          className="text-aura text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          COPY
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-border-subtle">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-aura shadow-[0_0_8px_#E8A87C]" />
                    <span className="text-[10px] text-aura uppercase tracking-widest font-bold">Inter-contract calls active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: FOOTER */}
      <footer className="py-12 border-t border-border-subtle bg-bg-void relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
            <div className="flex items-center gap-2">
              <span className="text-[#E8A87C] text-2xl">✦</span>
              <span className="font-['Cormorant_Garamond'] font-semibold text-lg tracking-[0.12em] text-primary">
                AURA MARKET
              </span>
            </div>
            
            <div className="flex flex-wrap gap-8">
              {["Gallery", "Mint", "Marketplace", "Portfolio", "Activity"].map(link => (
                <a key={link} href={`#${link.toLowerCase()}`} className="text-[10px] uppercase tracking-[0.2em] text-text-muted hover:text-aura transition-colors">
                  {link}
                </a>
              ))}
            </div>

            <div className="text-right">
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Built on Stellar Soroban</p>
              <p className="text-[10px] text-text-muted/50 tracking-widest">MIT LICENSE 2026</p>
            </div>
          </div>

          <div className="pt-8 border-t border-border-subtle/50">
            <p className="text-[10px] text-text-muted/40 text-center uppercase tracking-widest leading-relaxed">
              Smart contracts deployed on Stellar Testnet. Not financial advice. Always do your own research.<br />
              Digital assets carry inherent risks. Please trade responsibly.
            </p>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {listingModalNFT && (
        <ListingModal 
          nft={listingModalNFT}
          onClose={() => setListingModalNFT(null)}
          onList={handleList}
          isListing={isProcessing === listingModalNFT.id.toString()}
        />
      )}
    </div>
  );
}
