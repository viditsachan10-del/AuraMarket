"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getPublicKey,
  isConnected,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";
import {
  getServer,
  NETWORK_PASSPHRASE,
} from "@/lib/stellar";
import { rpc as SorobanRpc, TransactionBuilder } from "@stellar/stellar-sdk";

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  network: string | null;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isLoading: false,
    network: null,
    error: null,
  });

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      if (!(await isConnected())) {
        throw new Error("Freighter wallet not found");
      }

      const address = await getPublicKey();
      const network = await getNetwork();

      if (network.network !== "TESTNET") {
        throw new Error("Please switch Freighter to Testnet");
      }

      setState({
        address,
        isConnected: true,
        isLoading: false,
        network: network.network,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || "Failed to connect",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isLoading: false,
      network: null,
      error: null,
    });
  }, []);

  const signAndSubmit = useCallback(async (xdr: string): Promise<string> => {
    const server = getServer();
    
    // 1. Sign
    const { signedTxXdr, error } = await signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (error) throw new Error(error);

    // 2. Submit
    const response = await server.sendTransaction(
      TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
    );

    if (response.status === "ERROR") {
      throw new Error("Transaction submission failed");
    }

    // 3. Poll
    let getResponse = await server.getTransaction(response.hash);
    const start = Date.now();
    
    while (
      getResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND ||
      getResponse.status === SorobanRpc.Api.GetTransactionStatus.PENDING
    ) {
      if (Date.now() - start > 30000) throw new Error("Transaction timed out");
      await new Promise((r) => setTimeout(r, 2000));
      getResponse = await server.getTransaction(response.hash);
    }

    if (getResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return response.hash;
    } else {
      throw new Error(`Transaction failed with status: ${getResponse.status}`);
    }
  }, []);

  // Initial check
  useEffect(() => {
    isConnected().then((connected) => {
      if (connected) {
        getPublicKey().then((address) => {
          if (address) {
            getNetwork().then((net) => {
              setState({
                address,
                isConnected: true,
                isLoading: false,
                network: net.network,
                error: null,
              });
            });
          }
        });
      }
    });
  }, []);

  return { ...state, connect, disconnect, signAndSubmit };
}
