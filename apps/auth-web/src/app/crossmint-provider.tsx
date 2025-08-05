'use client';

import {
  CrossmintAuthProvider,
  CrossmintProvider,
  CrossmintWalletProvider,
} from '@crossmint/client-sdk-react-ui';
import { useEffect, useState } from 'react';

export function CrossmintProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only render Crossmint on the client to avoid SSR issues
  if (!isClient) {
    return <>{children}</>;
  }

  const apiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY || '';

  // Log the API key format for debugging (only first/last few chars for security)
  console.log('Crossmint API Key format check:', {
    length: apiKey.length,
    prefix: apiKey.substring(0, 10),
    suffix: apiKey.substring(apiKey.length - 10),
    hasInvalidChars: !/^[a-zA-Z0-9_-]+$/.test(apiKey),
    isEmpty: apiKey === '',
    env: process.env.NODE_ENV,
  });

  // Check if this is a production key vs staging key issue
  if (apiKey.startsWith('sk_')) {
    console.error(
      'WARNING: Using server key (sk_) instead of client key (ck_)'
    );
  }

  try {
    return (
      <CrossmintProvider apiKey={apiKey}>
        <CrossmintAuthProvider
          authModalTitle="SYMLog Authentication"
          loginMethods={['email', 'google']}
        >
          <CrossmintWalletProvider
            createOnLogin={{
              chain: 'solana',
              signer: { type: 'email' },
            }}
            showPasskeyHelpers={false}
          >
            {children}
          </CrossmintWalletProvider>
        </CrossmintAuthProvider>
      </CrossmintProvider>
    );
  } catch (error) {
    console.error('Crossmint Provider Error:', error);
    // Return children without Crossmint if there's an error
    return <>{children}</>;
  }
}
