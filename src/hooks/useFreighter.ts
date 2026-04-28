"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";

export interface WalletState {
  connected: boolean;
  address: string | null;
  network: string | null;
  loading: boolean;
  error: string | null;
}

export function useFreighter() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    network: null,
    loading: false,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    try {
      const connected = await isConnected();
      if (connected.isConnected) {
        const addressResult = await getAddress();
        const networkResult = await getNetwork();
        setState({
          connected: true,
          address: addressResult.address || null,
          network: networkResult.network || null,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({ ...prev, connected: false, address: null }));
      }
    } catch {
      setState((prev) => ({ ...prev, connected: false, error: null }));
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Freighter not installed. Please install the Freighter wallet extension.",
        }));
        return;
      }
      const addressResult = await getAddress();
      const networkResult = await getNetwork();
      setState({
        connected: true,
        address: addressResult.address || null,
        network: networkResult.network || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Connection failed",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      address: null,
      network: null,
      loading: false,
      error: null,
    });
  }, []);

  const sign = useCallback(
    async (xdr: string, opts?: { networkPassphrase?: string }) => {
      if (!state.connected) throw new Error("Wallet not connected");
      const result = await signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase,
      });
      if (result.error) throw new Error(result.error);
      return result.signedTxXdr;
    },
    [state.connected]
  );

  return { ...state, connect, disconnect, sign };
}
