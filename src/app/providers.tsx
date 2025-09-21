'use client';

import { ReactNode } from 'react';
import { WalletConnectionProvider } from '@/contexts/WalletConnectionProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletConnectionProvider>
      {children}
    </WalletConnectionProvider>
  );
}