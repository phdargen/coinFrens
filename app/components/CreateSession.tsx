"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { getFarcasterUserId, getFarcasterUsername } from "@/lib/farcaster-utils";
import { MAX_PROMPT_LENGTH } from "@/src/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight, Sparkles } from "lucide-react";

export function CreateSession() {
  const { context } = useMiniKit();
  const { isConnected, address } = useAccount();
  const [prompt, setPrompt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConnectWalletPrompt, setShowConnectWalletPrompt] = useState(false);
  const router = useRouter();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    
    if (prompt.length > MAX_PROMPT_LENGTH) {
      setError(`Prompt must be ${MAX_PROMPT_LENGTH} characters or less`);
      return;
    }
    
    // Allow creation without Farcaster if wallet is connected
    if (!context && !address) {
      setShowConnectWalletPrompt(true);
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Use our utility functions to safely get ID and username
      const fid = context ? getFarcasterUserId(context) : `wallet-${address}`;
      const username = context ? getFarcasterUsername(context) : address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : undefined;
      const pfpUrl = context?.user?.pfpUrl;
      
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
          address: address || undefined,
          pfpUrl
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
    <Card className="border bg-card">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Start a Jam Session
          <Sparkles className="h-5 w-5 text-primary" />
        </CardTitle>
        
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Textarea
              id="prompt"
              placeholder="Enter your part of the coin prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={MAX_PROMPT_LENGTH}
              rows={3}
              required
              className="resize-none bg-muted/50"
            />
            <p className="text-sm text-muted-foreground">
              This will be combined with other participants&apos; prompts to AI-generate your coin.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="participants" className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Number of Frens
            </Label>
            <Select
              value={maxParticipants.toString()}
              onValueChange={(value) => setMaxParticipants(parseInt(value))}
            >
              <SelectTrigger className="bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Frens</SelectItem>
                <SelectItem value="3">3 Frens</SelectItem>
                <SelectItem value="4">4 Frens</SelectItem>
                <SelectItem value="5">5 Frens</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Creating...
              </>
            ) : (
              <>
                Create 🚀
              </> 
            )}
          </Button>
          
        </form>
      </CardContent>

      {showConnectWalletPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm text-center shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Connect Wallet</h3>
            <p className="text-muted-foreground mb-6">
              Please sign in to create a session.
            </p>
            <Button onClick={() => setShowConnectWalletPrompt(false)} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
} 