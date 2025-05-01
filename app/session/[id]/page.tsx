"use client";

import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { LoadingComponent, ErrorComponent } from "@/app/components/UIComponents";
import { getFarcasterUserId } from "@/lib/farcaster-utils";

export default function SessionPage({ params }: { params: { id: string } }) {
  const { context } = useMiniKit();
  const { address } = useAccount();
  const [session, setSession] = useState<CoinSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = params.id;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/get-session?id=${sessionId}`);
        const data = await response.json();
        
        if (!data.success) {
          setError(data.error || "Session not found");
          return;
        }
        
        setSession(data.session);
      } catch (err) {
        console.error("Error fetching session:", err);
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  if (loading) {
    return <LoadingComponent text="Loading session..." />;
  }

  if (error) {
    return <ErrorComponent message={error} />;
  }

  if (!session) {
    return <ErrorComponent message="Session not found" />;
  }

  // Get user ID from either Farcaster or wallet
  const userFid = context ? getFarcasterUserId(context) : address ? `wallet-${address}` : "";
  const userHasJoined = !!session.prompts[userFid];
  const participantCount = Object.keys(session.prompts).length;
  const remainingSpots = session.maxParticipants - participantCount;
  
  // Helper function to format creator name
  const formatCreatorInfo = () => {
    if (session.creatorName) return session.creatorName;
    
    // If creator ID starts with "wallet-", it's a wallet address
    if (session.creatorFid.startsWith("wallet-")) {
      const walletAddress = session.creatorFid.replace("wallet-", "");
      return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
    }
    
    return `User #${session.creatorFid}`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Coin Frens</h1>
          <p className="mt-2 text-gray-500">Session #{session.id}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Session Status</h2>
          
          <div className="mb-6">
            <div className="font-medium">Creator</div>
            <div className="text-gray-600 dark:text-gray-400">
              {formatCreatorInfo()}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="font-medium">Participants</div>
            <div className="text-gray-600 dark:text-gray-400">
              {participantCount} of {session.maxParticipants} joined
              {remainingSpots > 0 && ` (${remainingSpots} spots remaining)`}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="font-medium">Status</div>
            <div className="flex items-center space-x-2">
              {session.status === "pending" && (
                <>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span>Waiting for participants...</span>
                </>
              )}
              {session.status === "generating" && (
                <>
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <span>Generating coin metadata...</span>
                </>
              )}
              {session.status === "complete" && (
                <>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span>Coin metadata generated!</span>
                </>
              )}
            </div>
          </div>
          
          {session.status === "complete" && session.metadata && (
            <div className="mb-6">
              <div className="font-medium mb-2">Coin Preview</div>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <div className="font-bold text-lg">{session.metadata.name}</div>
                <div className="text-sm font-medium">${session.metadata.symbol}</div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {session.metadata.description}
                </p>
                {session.metadata.imageUrl && (
                  <div className="mt-3">
                    <img 
                      src={session.metadata.imageUrl} 
                      alt={session.metadata.name}
                      className="max-w-full rounded-lg max-h-40 mx-auto"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {!userHasJoined && session.status === "pending" && (
            <div className="text-center mt-4">
              <a
                href={`/join/${session.id}`}
                className="inline-block py-2 px-4 bg-primary text-white rounded-md hover:bg-opacity-90 transition"
              >
                Join This Session
              </a>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <a href="/join" className="text-primary hover:underline">
            Back to all sessions
          </a>
        </div>
      </div>
    </main>
  );
} 