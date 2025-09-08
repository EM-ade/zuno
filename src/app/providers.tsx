'use client';

import { ReactNode } from 'react';
import { WalletProvider } from '@/contexts/WalletContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}