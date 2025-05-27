"use client";

import { useState, useEffect } from "react";
import { CoinSession } from "@/lib/types";
import { CompletedCoinsList } from "./CompletedCoinsList";
import { LoadingComponent } from "./UIComponents";
import { Card, CardContent } from "@/components/ui/card";

export function CompletedCoinsPage() {
  const [sessions, setSessions] = useState<CoinSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompletedSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/get-completed-sessions");
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch completed sessions");
      }
      
      setSessions(data.sessions);
    } catch (err) {
      console.error("Error fetching completed sessions:", err);
      setError("Failed to load completed coins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedSessions();
  }, []);

  if (loading) {
    return <LoadingComponent text="Loading completed coins..." />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm font-medium text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Completed Coins List */}
      <CompletedCoinsList 
        sessions={sessions} 
      />
    </div>
  );
} 