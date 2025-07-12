"use client";

import { type ReactNode } from "react";
import { base, baseSepolia } from "wagmi/chains";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { coinbaseWallet, injected, metaMask } from "wagmi/connectors";
import { WagmiProvider } from "wagmi";
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

// Create wagmi config with multiple connectors
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  pollingInterval: 60_000,
  connectors: [
    miniAppConnector(),
    metaMask(),
    coinbaseWallet({
      appName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'TrueCast',
    }),
    injected({
      shimDisconnect: true,
    })
  ],
});

// Create a client for react-query
const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MiniKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
          config={{
            appearance: {
              mode: "auto",
              theme: "base",
              name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
              logo: process.env.NEXT_PUBLIC_ICON_URL,
            },
            paymaster: process.env.PAYMASTER_ENDPOINT,
            // wallet: {
            //   display: 'modal',
            //   termsUrl: 'https://...',
            //   privacyUrl: 'https://...',
            //   supportedWallets: { 
            //     rabby: true, 
            //     trust: true, 
            //     frame: true, 
            //   }, 
            // }
          }}
        >
          {props.children}
        </MiniKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}