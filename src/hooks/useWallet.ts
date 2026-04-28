"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getAddress,
  isConnected,
  getNetwork,
  signTransaction,
  setAllowed,
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
      console.log("Checking Freighter connection...");
      const connectedRes = await isConnected();
      if (!connectedRes.isConnected) {
        throw new Error("Freighter wallet not found. Please install the extension.");
      }

      console.log("Requesting access...");
      // setAllowed() is the recommended way to trigger the "Access Request" popup
      const isAllowedRes = await setAllowed();
      if (!isAllowedRes.isAllowed) {
        throw new Error("Access denied by user");
      }

      const addressRes = await getAddress();
      if (addressRes.error) {
        throw new Error(addressRes.error as string);
      }
      const address = addressRes.address;
      console.log("Connected address:", address);
      
      const networkRes = await getNetwork();
      if (networkRes.error) {
        throw new Error(networkRes.error as string);
      }
      const network = networkRes.network;
      console.log("Network:", network);

      if (network !== "TESTNET") {
        throw new Error("Please switch Freighter to Testnet");
      }

      setState({
        address,
        isConnected: true,
        isLoading: false,
        network: network,
        error: null,
      });
    } catch (err: any) {
      console.error("Wallet connection error:", err);
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
      getResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
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
    isConnected().then((connectedRes) => {
      if (connectedRes.isConnected) {
        getAddress().then((addressRes) => {
          if (addressRes.address) {
            getNetwork().then((netRes) => {
              setState({
                address: addressRes.address,
                isConnected: true,
                isLoading: false,
                network: netRes.network,
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
