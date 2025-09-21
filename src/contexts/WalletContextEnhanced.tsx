'use client'

import React, { useMemo, useEffect, useState } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import the wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: React.ReactNode;
}

// Custom hook to handle wallet connection issues
export function useWalletConnection() {
  const wallet = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const connectWallet = async () => {
    if (wallet.connected || isConnecting) return;
    
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Add a small delay to ensure wallet is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (wallet.select && wallet.wallets.length > 0) {
        // Prefer Phantom if available
        const phantomWallet = wallet.wallets.find(w => w.adapter.name === 'Phantom');
        if (phantomWallet) {
          wallet.select(phantomWallet.adapter.name);
        }
      }
      
      await wallet.connect();
    } catch (error) {
      console.error('Wallet connection error:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect wallet');
      
      // Retry logic for Phantom
      if (error instanceof Error && error.message.includes('Phantom')) {
        console.log('Retrying Phantom connection...');
        setTimeout(async () => {
          try {
            await wallet.connect();
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }, 1000);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    ...wallet,
    connectWallet,
    isConnecting,
    connectionError,
  };
}

export function WalletProvider({ children }: WalletProviderProps) {
  // Use mainnet-beta for production
  const network = WalletAdapterNetwork.Mainnet;
  
  // Use custom RPC endpoint for better reliability
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) return customRpc;
    
    // Use a more reliable RPC endpoint
    const endpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana',
    ];
    
    // Return the first endpoint (you could implement failover logic here)
    return endpoints[0];
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  // Test connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const connection = new Connection(endpoint, 'confirmed');
        const version = await connection.getVersion();
        console.log('Solana connection established:', version);
      } catch (error) {
        console.error('Failed to establish Solana connection:', error);
      }
    };
    
    testConnection();
  }, [endpoint]);

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={{
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000, // 60 seconds timeout
      }}
    >
      <SolanaWalletProvider 
        wallets={wallets} 
        autoConnect={false} // Disable autoConnect for better control
        onError={(error) => {
          console.error('Wallet error:', error);
          // Show user-friendly error message
          if (error.message?.includes('User rejected')) {
            console.log('User cancelled wallet connection');
          } else if (error.message?.includes('Phantom')) {
            console.log('Phantom wallet issue detected, please try again');
          }
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

// Wallet connection helper component
export function WalletConnectionHelper() {
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const [showHelper, setShowHelper] = useState(false);

  useEffect(() => {
    // Show helper if connection is taking too long
    if (connecting) {
      const timer = setTimeout(() => {
        setShowHelper(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    } else {
      setShowHelper(false);
    }
  }, [connecting]);

  if (!showHelper) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-50">
      <p className="font-bold">Connection taking longer than expected</p>
      <p className="text-sm mt-1">
        Please check that your wallet extension is unlocked and try again.
      </p>
      <button
        onClick={() => {
          disconnect();
          setShowHelper(false);
        }}
        className="mt-2 text-sm underline hover:no-underline"
      >
        Cancel and retry
      </button>
    </div>
  );
}
