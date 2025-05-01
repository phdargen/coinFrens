"use client";

import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { SessionList } from "../components/SessionList";
import { LoadingComponent } from "../components/UIComponents";
import { getFarcasterUserId } from "@/lib/farcaster-utils";

export default function JoinPage() {
  const { context } = useMiniKit();
  const { address } = useAccount();
  const [sessions, setSessions] = useState<CoinSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/get-sessions");
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch sessions");
      }
      
      setSessions(data.sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError("Failed to load active sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  if (loading) {
    return <LoadingComponent text="Loading available sessions..." />;
  }

  // Get user ID from either Farcaster or wallet
  const userFid = context ? getFarcasterUserId(context) : address ? `wallet-${address}` : "";

  const isConnected = !!context || !!address;

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Coin Frens</h1>
          <p className="mt-2 text-gray-500">Join an existing coin creation session</p>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-800 rounded-md">
            {error}
          </div>
        )}

        {!isConnected && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-center">
            Connect with Farcaster or a wallet to join sessions
          </div>
        )}

        <SessionList 
          sessions={sessions} 
          onRefresh={fetchSessions} 
          userFid={userFid}
        />

        <div className="text-center">
          <a href="/" className="text-primary hover:underline">
            Or create your own session
          </a>
        </div>
      </div>
    </main>
  );
} 