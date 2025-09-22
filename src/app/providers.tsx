'use client';

import { ReactNode } from 'react';
import { WalletConnectionProvider } from '@/contexts/WalletConnectionProvider';
import LoadingScreen from '@/components/LoadingScreen'; // Import the new component

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletConnectionProvider>
      <LoadingScreen>{children}</LoadingScreen>
    </WalletConnectionProvider>
  );
}