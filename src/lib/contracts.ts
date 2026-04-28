import {
  Contract,
  TransactionBuilder,
  rpc as SorobanRpc,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  NFT_CONTRACT_ID,
  MARKETPLACE_CONTRACT_ID,
  NATIVE_ASSET_CONTRACT,
  getServer,
} from "./stellar";

// ── Freighter Integration ───────────────────────────────────────────────────

export async function addNFTContractToFreighter(): Promise<void> {
  const { addToken } = await import("@stellar/freighter-api");
  if (typeof addToken === "function") {
    await addToken({
      contractId: NFT_CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
  } else {
    await navigator.clipboard.writeText(NFT_CONTRACT_ID);
    throw new Error("COPIED_FALLBACK");
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface NFTMetadata {
  id: bigint;
  name: string;
  description: string;
  imageUrl: string;
  owner: string;
  creator: string;
  createdAt: bigint;
  isListed: boolean;
}

export interface Listing {
  nftId: bigint;
  seller: string;
  priceXlm: bigint;
  active: boolean;
  listedAt: bigint;
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/** Encode a JS string as a Soroban String ScVal (not Bytes). */
function scvString(s: string): xdr.ScVal {
  return xdr.ScVal.scvString(Buffer.from(s, "utf8"));
}

async function buildAndSimulate(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: any[]
): Promise<string> {
  const server = getServer();
  const contract = new Contract(contractId);
  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, simulation).build();
  return assembled.toXDR();
}

// ── NFT Contract Functions ───────────────────────────────────────────────────

export async function mintNFT(
  to: string,
  name: string,
  description: string,
  imageUrl: string
): Promise<string> {
  return buildAndSimulate(to, NFT_CONTRACT_ID, "mint", [
    nativeToScVal(to, { type: "address" }),
    scvString(name),
    scvString(description || ""),
    scvString(imageUrl),
  ]);
}

export async function transferNFT(
  from: string,
  to: string,
  nftId: bigint
): Promise<string> {
  return buildAndSimulate(from, NFT_CONTRACT_ID, "transfer", [
    nativeToScVal(from, { type: "address" }),
    nativeToScVal(from, { type: "address" }),
    nativeToScVal(to, { type: "address" }),
    nativeToScVal(nftId, { type: "u64" }),
  ]);
}

export async function getNFT(nftId: bigint): Promise<NFTMetadata> {
  const server = getServer();
  const contract = new Contract(NFT_CONTRACT_ID);
  const tx = new TransactionBuilder(
    await server.getAccount("GB7I5LEIWEUYB2GECXYBBJ56TXGWP2SDVJFLZRHYUNVPCDADVA5VIY7Y"), // Placeholder for simulation
    {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    }
  )
    .addOperation(contract.call("get_nft", nativeToScVal(nftId, { type: "u64" })))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation) || !simulation.result) {
    throw new Error("Failed to fetch NFT metadata");
  }

  const res = scValToNative(simulation.result.retval);
  return {
    id: BigInt(res.id),
    name: res.name,
    description: res.description,
    imageUrl: res.image_url,
    owner: res.owner,
    creator: res.creator,
    createdAt: BigInt(res.created_at),
    isListed: res.is_listed,
  };
}

export async function getOwnerNFTs(owner: string): Promise<bigint[]> {
  const server = getServer();
  const contract = new Contract(NFT_CONTRACT_ID);
  const tx = new TransactionBuilder(
    await server.getAccount("GB7I5LEIWEUYB2GECXYBBJ56TXGWP2SDVJFLZRHYUNVPCDADVA5VIY7Y"),
    { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(contract.call("get_owner_nfts", nativeToScVal(owner, { type: "address" })))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation) || !simulation.result) return [];
  return (scValToNative(simulation.result.retval) as any[]).map((v) => BigInt(v));
}

export async function getTotalSupply(): Promise<bigint> {
  const server = getServer();
  const contract = new Contract(NFT_CONTRACT_ID);
  const tx = new TransactionBuilder(
    await server.getAccount("GB7I5LEIWEUYB2GECXYBBJ56TXGWP2SDVJFLZRHYUNVPCDADVA5VIY7Y"),
    { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(contract.call("total_supply"))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation) || !simulation.result) return BigInt(0);
  return BigInt(scValToNative(simulation.result.retval));
}

// ── Marketplace Contract Functions ───────────────────────────────────────────

export async function listNFT(
  seller: string,
  nftId: bigint,
  priceXlm: number
): Promise<string> {
  const priceStroops = BigInt(Math.floor(priceXlm * 10 ** 7));
  return buildAndSimulate(seller, MARKETPLACE_CONTRACT_ID, "list_nft", [
    nativeToScVal(seller, { type: "address" }),
    nativeToScVal(nftId, { type: "u64" }),
    nativeToScVal(priceStroops, { type: "i128" }),
  ]);
}

export async function buyNFT(buyer: string, nftId: bigint): Promise<string> {
  return buildAndSimulate(buyer, MARKETPLACE_CONTRACT_ID, "buy_nft", [
    nativeToScVal(buyer, { type: "address" }),
    nativeToScVal(nftId, { type: "u64" }),
  ]);
}

export async function delistNFT(
  seller: string,
  nftId: bigint
): Promise<string> {
  return buildAndSimulate(seller, MARKETPLACE_CONTRACT_ID, "delist_nft", [
    nativeToScVal(seller, { type: "address" }),
    nativeToScVal(nftId, { type: "u64" }),
  ]);
}

export async function getListing(nftId: bigint): Promise<Listing> {
  const server = getServer();
  const contract = new Contract(MARKETPLACE_CONTRACT_ID);
  const tx = new TransactionBuilder(
    await server.getAccount("GB7I5LEIWEUYB2GECXYBBJ56TXGWP2SDVJFLZRHYUNVPCDADVA5VIY7Y"),
    { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(contract.call("get_listing", nativeToScVal(nftId, { type: "u64" })))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation) || !simulation.result) {
    throw new Error("Failed to fetch listing");
  }

  const res = scValToNative(simulation.result.retval);
  return {
    nftId: BigInt(res.nft_id),
    seller: res.seller,
    priceXlm: BigInt(res.price_xlm),
    active: res.active,
    listedAt: BigInt(res.listed_at),
  };
}

export async function getActiveListings(): Promise<bigint[]> {
  const server = getServer();
  const contract = new Contract(MARKETPLACE_CONTRACT_ID);
  const tx = new TransactionBuilder(
    await server.getAccount("GB7I5LEIWEUYB2GECXYBBJ56TXGWP2SDVJFLZRHYUNVPCDADVA5VIY7Y"),
    { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(contract.call("get_active_listings"))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation) || !simulation.result) return [];
  return (scValToNative(simulation.result.retval) as any[]).map((v) => BigInt(v));
}
