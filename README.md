# ✦ AuraMarket

> NFT minting and peer-to-peer marketplace built on Stellar Soroban smart contracts.

![CI](https://github.com/viditsachan10-del/auramarket/actions/workflows/ci.yml/badge.svg)

## Live Demo
🔗 [auramarket.vercel.app](https://auramarket.vercel.app)

## What is AuraMarket?
AuraMarket is a high-fidelity NFT platform that brings the "Dark Luxury" aesthetic to the Stellar network. It allows creators to mint unique digital assets with rich metadata and trade them in a decentralized marketplace. Built entirely on Soroban, it leverages inter-contract communication to ensure secure and verified peer-to-peer trading.

## Features
- ✦ **Mint NFTs** on-chain with custom metadata and persistent artwork
- 🔄 **Inter-contract calls:** Marketplace verifies ownership and status via NFT contract
- 🛒 **Marketplace:** Peer-to-peer listing and purchasing using XLM
- 📊 **Real-time Activity:** Live protocol event feed polled directly from the blockchain
- 🔐 **Freighter Wallet:** Native Stellar authentication and transaction signing
- 📱 **Mobile Responsive:** Elegant "Dark Luxury" UI optimized for all devices

## Screenshots

### Desktop View
![Desktop View Placeholder](https://via.placeholder.com/1200x800?text=AuraMarket+Desktop+View)

### Mobile Responsive View  
![Mobile View Placeholder](https://via.placeholder.com/400x800?text=AuraMarket+Mobile+View)

### CI/CD Pipeline
![CI Build Placeholder](https://via.placeholder.com/800x400?text=GitHub+Actions+Green+Build)

## Smart Contracts (Stellar Testnet)

| Contract | Address | Description |
|---|---|---|
| NFT Contract | `CC4YDGOA7SMKUNSMDB2BK6XD25ALBYWK43WZUOSK6SAGKHSRUPT736OE` | Handles minting, ownership, and metadata |
| Marketplace | `CBOVFUFZW73GIJ2FNKVNDA7ZQWTW4MLLIMVKKZGRL6EM7QPJSHBTQJS3` | Handles listing, buying, and fee distribution |

### Inter-Contract Calls
The Marketplace contract performs critical inter-contract operations with the NFT contract:
1. `list_nft` → calls `nft.get_nft()` to verify ownership before listing
2. `list_nft` → calls `nft.set_listed()` to prevent multiple listings
3. `buy_nft` → calls `nft.transfer()` to execute secure ownership change

**Deployment transaction hash:** `a24c14e12838f879c5cb22096a65e8023d126baaf1b9617f55aa3741d93fd004`

## Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, SWR
- **Smart Contracts:** Rust, Soroban SDK 21.0.0
- **Wallet:** Freighter API (@stellar/freighter-api)
- **Network:** Stellar Testnet
- **CI/CD:** GitHub Actions → Vercel

## Local Development

Prerequisites: Node.js 20+, Rust, soroban-cli

```bash
# Clone
git clone https://github.com/viditsachan10-del/auramarket
cd auramarket

# Frontend
cd frontend
cp .env.example .env.local
# Fill in contract addresses in .env.local
npm install
npm run dev

# Build contracts
cd contracts/nft
cargo build --target wasm32-unknown-unknown --release

cd ../marketplace  
cargo build --target wasm32-unknown-unknown --release
```

## Environment Variables
See `frontend/.env.example` for required variables.

## CI/CD
GitHub Actions runs on every push:
1. Builds both Rust contracts to WASM
2. Runs contract unit tests
3. Type-checks and lints frontend
4. Builds Next.js production bundle
5. Deploys to Vercel on merge to main

## License
MIT
