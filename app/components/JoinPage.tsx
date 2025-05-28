"use client";

import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { SessionList } from "./SessionList";
import { LoadingComponent } from "./UIComponents";
import { getFarcasterUserId } from "@/lib/farcaster-utils";
import { Card, CardContent} from "@/components/ui/card";

export function JoinPage() {
  const { context } = useMiniKit();
  const { address } = useAccount();
  const [sessions, setSessions] = useState<CoinSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Add client-side mount check to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  if (loading) {
    return <LoadingComponent text="Finding awesome sessions..." />;
  }

  // Don't calculate user-dependent values until component is mounted to prevent hydration errors
  if (!isMounted) {
    return <LoadingComponent text="Loading..." />;
  }

  // Get user ID from either Farcaster or wallet
  const userFid = context ? getFarcasterUserId(context) : address ? `wallet-${address}` : "";

  return (
    <div className="space-y-6">

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm font-medium text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      <SessionList 
        sessions={sessions} 
        userFid={userFid}
      />
    </div>
  );
} 