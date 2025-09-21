'use client'

import React, { useMemo, useEffect } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import the wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  // Use devnet for testing
  const network = WalletAdapterNetwork.Devnet;
  
  // Use custom RPC or fallback to devnet
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }
    // Use devnet RPC for testing
    return 'https://api.devnet.solana.com';
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
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
        autoConnect={true} // More seamless experience
        onError={(error) => {
          console.error('Wallet error:', error);
          // Handle specific wallet errors
          if (error.message?.includes('User rejected')) {
            console.log('User cancelled wallet connection');
          } else if (error.message?.includes('Phantom')) {
            console.log('Phantom wallet issue - please ensure wallet is unlocked');
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