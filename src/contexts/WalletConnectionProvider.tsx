'use client';

import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useBaseWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react'; // Import WalletContextState

import '@solana/wallet-adapter-react-ui/styles.css';

// Define the shape of our custom wallet context
interface WalletConnectionContextState {
  publicKey: PublicKey | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: WalletContextState['sendTransaction']; // Add sendTransaction
}

const WalletConnectionContext = createContext<WalletConnectionContextState | undefined>(
  undefined
);

// The custom hook that components will use
export const useWalletConnection = () => {
  const context = useContext(WalletConnectionContext);
  if (context === undefined) {
    throw new Error('useWalletConnection must be used within a WalletConnectionProvider');
  }
  return context;
};

// The manager that wraps the base wallet adapter logic
function useWalletConnectionManager() {
  const wallet = useBaseWallet();
  const { setVisible } = useWalletModal();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (wallet.connected || wallet.connecting || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // If no wallet is selected, open the modal.
      if (!wallet.wallet) {
        setVisible(true);
        // The modal will trigger the connection, but we need to wait.
        // A common pattern is to just let the user handle it from the modal.
        // We'll set connecting to false and let the adapter's state take over.
        setIsConnecting(false);
      }
      
      console.log('Attempting to connect to:', wallet.wallet?.adapter.name);
      await wallet.connect(); // Uncommented manual connect call

    } catch (e) {
      const err = e as WalletError;
      console.error('Wallet connection error:', err);
      let userMessage = 'An unknown error occurred.';
      if (err.name === 'WalletNotSelectedError') {
        setVisible(true);
        return; // Just open the modal without showing error
      } else if (err.name === 'WalletConnectionError' || err.name === 'WalletDisconnectedError') {
        userMessage = 'Connection failed. Please try again.';
      } else if (err.name === 'WalletSignTransactionError') {
        userMessage = 'Failed to sign transaction. Please try again.';
      }
      setError(userMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [wallet, setVisible, isConnecting]);

  const disconnect = useCallback(async () => {
    if (wallet.connected) {
      try {
        await wallet.disconnect();
      } catch (e) {
        console.error('Wallet disconnection error:', e);
        setError('Failed to disconnect. Please refresh the page.');
      }
    }
  }, [wallet]);

  return {
    publicKey: wallet.publicKey,
    isConnected: wallet.connected,
    isConnecting: wallet.connecting || isConnecting,
    error,
    connect,
    disconnect,
    sendTransaction: wallet.sendTransaction, // Return sendTransaction
  };
}

// The main provider component that will wrap the application
export function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network), [network]);
  
  // Log network configuration for debugging
  console.log(`Wallet Connection Network Configuration:`);
  console.log(`- Network: ${network}`);
  console.log(`- RPC Endpoint: ${endpoint}`);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          <WalletManager>{children}</WalletManager>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

// A helper component to bridge the providers and our custom manager
function WalletManager({ children }: { children: ReactNode }) {
  const manager = useWalletConnectionManager();
  return (
    <WalletConnectionContext.Provider value={manager}>
      {children}
    </WalletConnectionContext.Provider>
  );
}
