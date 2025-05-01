"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { LoadingComponent, ErrorComponent } from "@/app/components/UIComponents";
import { getFarcasterUserId, getFarcasterUsername } from "@/lib/farcaster-utils";

export default function JoinSessionPage({ params }: { params: { id: string } }) {
  const { context } = useMiniKit();
  const { address } = useAccount();
  const router = useRouter();
  const [session, setSession] = useState<CoinSession | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    
    // Allow joining without Farcaster if wallet is connected
    if (!context && !address) {
      setError("Please connect with Farcaster or a wallet");
      return;
    }
    
    const userFid = context ? getFarcasterUserId(context) : `wallet-${address}`;
    const username = context ? getFarcasterUsername(context) : address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : undefined;
    
    if (!userFid) {
      setError("Unable to identify your account");
      return;
    }
    
    // Check if the user has already joined
    if (session?.prompts[userFid]) {
      setError("You have already joined this session");
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Add the prompt to the session
      const response = await fetch("/api/add-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          fid: userFid,
          prompt,
          username,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add prompt");
      }
      
      // Redirect to the session page
      router.push(`/session/${sessionId}`);
    } catch (err) {
      console.error("Error adding prompt:", err);
      setError("Failed to join session. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingComponent text="Loading session..." />;
  }

  if (error) {
    return <ErrorComponent message={error} />;
  }

  if (!session) {
    return <ErrorComponent message="Session not found" />;
  }

  const userFid = context ? getFarcasterUserId(context) : address ? `wallet-${address}` : "";
  const userHasJoined = !!session.prompts[userFid];
  const participantCount = Object.keys(session.prompts).length;
  const isFull = participantCount >= session.maxParticipants;

  if (userHasJoined) {
    // If user has already joined, redirect to the session page
    router.push(`/session/${sessionId}`);
    return <LoadingComponent text="Redirecting..." />;
  }

  if (isFull) {
    return (
      <ErrorComponent message="This session is already full" />
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Coin Frens</h1>
          <p className="mt-2 text-gray-500">Join Session #{sessionId}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Join This Coin Creation</h2>
          
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
            
            <button
              type="submit"
              className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-opacity-90 transition"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Joining..." : "Join Coin Session"}
            </button>
            
            {!context && !address && (
              <p className="text-center text-sm text-yellow-500 mt-2">
                Connect with Farcaster or a wallet to join
              </p>
            )}
          </form>
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