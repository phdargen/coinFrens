"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { getFarcasterUserId, getFarcasterUsername } from "@/lib/farcaster-utils";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";

export default function Home() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const { address } = useAccount();
  const [prompt, setPrompt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    
    // Allow creation without Farcaster if wallet is connected
    if (!context && !address) {
      setError("Please connect with Farcaster or a wallet");
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Use our utility functions to safely get ID and username
      const fid = context ? getFarcasterUserId(context) : `wallet-${address}`;
      const username = context ? getFarcasterUsername(context) : address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : undefined;
      
      if (!fid) {
        throw new Error("Could not identify your account");
      }
      
      // Create session via API
      const sessionResponse = await fetch("/api/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creatorFid: fid,
          creatorName: username,
          maxParticipants,
          prompt,
        }),
      });
      
      const sessionData = await sessionResponse.json();
      
      if (!sessionData.success || !sessionData.session) {
        throw new Error(sessionData.error || "Failed to create session");
      }
      
      const session = sessionData.session;
      console.log("Session created:", session);
      
      // Redirect to the session page
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
      setError(err instanceof Error ? err.message : "Failed to create session. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <Wallet className="z-10">
          <ConnectWallet>
            <Name className="text-inherit" />
          </ConnectWallet>
          <WalletDropdown>
            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
              <Avatar />
              <Name />
              <Address />
              <EthBalance />
            </Identity>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Coin Frens</h1>
          <p className="mt-2 text-gray-500">Collaborate with friends to create a content coin</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Start a New Coin Creation</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block mb-1 font-medium">
                Your Prompt Part
              </label>
              <textarea
                id="prompt"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700"
                placeholder="Enter your part of the coin prompt..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                This will be combined with other participants&apos; prompts to generate your coin.
              </p>
            </div>
            
            <div>
              <label htmlFor="participants" className="block mb-1 font-medium">
                Number of Participants
              </label>
              <select
                id="participants"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              >
                <option value={2}>2 Participants</option>
                <option value={3}>3 Participants</option>
                <option value={4}>4 Participants</option>
                <option value={5}>5 Participants</option>
              </select>
            </div>
            
            <button
              type="submit"
              className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-opacity-90 transition"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Coin Session"}
            </button>
            
            {!context && !address && (
              <p className="text-center text-sm text-yellow-500 mt-2">
                Connect with Farcaster or a wallet to create a session
              </p>
            )}
          </form>
        </div>
        
        <div className="text-center">
          <a href="/join" className="text-primary hover:underline">
            Or join an existing session
          </a>
        </div>
      </div>
    </main>
  );
}
