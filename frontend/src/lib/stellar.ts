import {
  rpc as SorobanRpc,
  xdr,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";

// ── Constants ────────────────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const NFT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ID || "";

export const MARKETPLACE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID || "";

export const NATIVE_ASSET_CONTRACT =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(SOROBAN_RPC_URL);
}

export function scValToString(val: xdr.ScVal): string {
  return scValToNative(val).toString();
}

export function addressToScVal(address: string): xdr.ScVal {
  return nativeToScVal(address, { type: "address" });
}

export function numberToI128(num: number | bigint): xdr.ScVal {
  return nativeToScVal(num, { type: "i128" });
}

export function i128ToNumber(val: xdr.ScVal): number {
  return Number(scValToNative(val));
}

export function truncateAddress(address: string): string {
  if (!address) return "";
  return address.slice(0, 4) + "..." + address.slice(-4);
}

export function formatXLM(stroops: bigint | string | number): string {
  const val = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  return (Number(val) / 10 ** 7).toFixed(2);
}
