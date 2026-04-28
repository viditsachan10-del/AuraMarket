"use client";

import React, { useState } from "react";
import { useToast } from "./Toast";
import { mintNFT, getTotalSupply, addNFTContractToFreighter } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";

interface MintFormProps {
  onSuccess: (nftId: bigint) => void;
  walletAddress: string | null;
  onConnect: () => void;
  isMinting: boolean;
  setIsMinting: (b: boolean) => void;
}

export default function MintForm({
  onSuccess,
  walletAddress,
  onConnect,
  isMinting,
  setIsMinting,
}: MintFormProps) {
  const { addToast } = useToast();
  const { signAndSubmit } = useWallet();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
  });
  const [previewError, setPreviewError] = useState(false);

  const isFormValid = formData.name.length > 0 && formData.imageUrl.startsWith("https://");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      onConnect();
      return;
    }

    setIsMinting(true);

    try {
      const xdr = await mintNFT(
        walletAddress,
        formData.name,
        formData.description,
        formData.imageUrl
      );
      await signAndSubmit(xdr);

      // Fetch the latest total supply to know the newly minted NFT id
      const newId = await getTotalSupply();

      addToast("success", `✦ NFT minted successfully!`);
      onSuccess(newId);
      setFormData({ name: "", description: "", imageUrl: "" });

      try {
        await addNFTContractToFreighter();
        addToast("success", `✦ NFT contract added to Freighter!`);
      } catch (e: any) {
        if (e.message === "COPIED_FALLBACK") {
          addToast("success", `Contract ID copied! In Freighter: Menu → Manage Assets → Add → Paste`);
        }
      }
    } catch (err: any) {
      addToast("error", err.message || "Failed to mint NFT");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="glass-card p-8 w-full max-w-xl mx-auto reveal">
      <div className="mb-8">
        <h2 className="text-3xl mb-2">Create New Aura</h2>
        <p className="text-text-secondary text-sm">
          Mint your unique digital masterpiece onto the Stellar network.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* NFT Name */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-widest text-text-muted font-bold">
              Aura Name
            </label>
            <span className="text-[10px] text-text-muted">{formData.name.length}/50</span>
          </div>
          <input
            type="text"
            required
            maxLength={50}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Celestial Void #01"
            className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-aura focus:outline-none transition-colors placeholder:text-text-muted/30"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-widest text-text-muted font-bold">
              Description
            </label>
            <span className="text-[10px] text-text-muted">{formData.description.length}/200</span>
          </div>
          <textarea
            maxLength={200}
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the essence of your aura..."
            className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-aura focus:outline-none transition-colors resize-none placeholder:text-text-muted/30"
          />
        </div>

        {/* Image URL & Preview */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-text-muted font-bold">
              Artwork URL (HTTPS)
            </label>
            <input
              type="url"
              required
              value={formData.imageUrl}
              onChange={(e) => {
                setFormData({ ...formData, imageUrl: e.target.value });
                setPreviewError(false);
              }}
              placeholder="https://ipfs.io/ipfs/..."
              className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-aura focus:outline-none transition-colors placeholder:text-text-muted/30"
            />
          </div>

          {/* Preview Window */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-bg-void/50 border border-dashed border-border-subtle">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-bg-deep flex-shrink-0">
              {formData.imageUrl && !previewError ? (
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  onError={() => setPreviewError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-aura/10 to-aura-gold/10 text-aura/30 font-bold">
                  ✦
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">
                Preview Artwork
              </span>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Ensure your image is hosted on a secure permanent storage like IPFS or Arweave.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Section */}
        <div className="pt-4 space-y-3">
          <button
            type="submit"
            disabled={isMinting || (walletAddress !== null && !isFormValid)}
            className="btn-aura w-full h-[52px] flex items-center justify-center gap-2 text-base"
          >
            {isMinting ? (
              <>
                <div className="w-4 h-4 border-2 border-bg-void border-t-transparent rounded-full animate-spin" />
                <span>Minting Aura...</span>
              </>
            ) : !walletAddress ? (
              "Connect Wallet to Mint"
            ) : (
              <>
                <span className="text-lg">✦</span>
                <span>Mint NFT</span>
              </>
            )}
          </button>

          {!isMinting && (
            <p className="text-center text-[10px] text-text-muted tracking-wide">
              ESTIMATED NETWORK FEE:{" "}
              <span className="text-aura-gold">~0.01 XLM</span>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
