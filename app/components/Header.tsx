"use client";
import Image from "next/image";
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import { useAccount } from 'wagmi';
import WalletConnect from './WalletConnect';

export function Header() {
  const { context } = useMiniKit();
  const { address, isConnected } = useAccount();

  const { data: name } = useName({ 
    address: address as `0x${string}`, 
    chain: base 
  });

  return (
    <>
      {/* Logo Section */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4">
          <Image 
            src="/coinFrens.png" 
            alt="CoinFrens Logo" 
            width={64} 
            height={64}
            className="h-16 w-16"
          />
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              CoinJoin
            </h1>
            <p className="text-lg text-muted-foreground">
              Coin with your <span className="text-primary font-semibold">frens</span>
            </p>
          </div>
          <Image 
            src="/coinFrens.png" 
            alt="CoinFrens Logo" 
            width={64} 
            height={64}
            className="h-16 w-16"
          />
        </div>
      </div>

      {/* User Info or Wallet Connect */}
      <div className="flex justify-left">
        {address ? (
          /* Connected User Display */
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border/50">
            <img
              src={context?.user?.pfpUrl || "/coinFrens.png"} 
              alt="Profile" 
              width={32}
              height={32}
              className="rounded-full"
            />
            <div className="flex flex-col text-xl font-bold text-white">
              {context?.user?.displayName && (
                <span className="text-xl font-bold text-white">{context.user.displayName}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {name || `${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
            </div>
          </div>
        ) : (
          /* Wallet Connect Button */
          <WalletConnect />
        )}
      </div>
    </>
  );
} 