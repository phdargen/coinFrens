"use client";

import { useState, useEffect } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { useMiniKit, useViewProfile } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { LoadingComponent, ErrorComponent } from "@/app/components/UIComponents";
import { Header } from "@/app/components/Header";
import { getFarcasterUserId, getFarcasterUsername } from "@/lib/farcaster-utils";
import { MAX_PROMPT_LENGTH } from "@/src/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, ArrowLeft } from "lucide-react";
import { AddFramePopup } from "@/app/components/AddFramePopup";

export default function JoinSessionPage({ params }: { params: { id: string } }) {
  const { context } = useMiniKit();
  const { address } = useAccount();
  const router = useRouter();
  const viewProfile = useViewProfile();
  const [session, setSession] = useState<CoinSession | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConnectWalletPrompt, setShowConnectWalletPrompt] = useState(false);
  const [showAddFramePopup, setShowAddFramePopup] = useState(false);
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(null);
  const [isGeneratingCoin, setIsGeneratingCoin] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);


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

  const handleViewProfile = React.useCallback((fid: number | undefined) => {
    if (fid) {
      viewProfile(fid);
    }
  }, [viewProfile]);

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
    
    // Allow joining without Farcaster if wallet is connected
    if (!context && !address) {
      setShowConnectWalletPrompt(true);
      return;
    }
    
    const userFid = context ? getFarcasterUserId(context) : `wallet-${address}`;
    const username = context ? getFarcasterUsername(context) : address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : undefined;
    const pfpUrl = context?.user?.pfpUrl;
    
    if (!userFid) {
      setError("Unable to identify your account");
      return;
    }
    
    // Check if the user has already joined
    if (session?.participants?.[userFid]) {
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
          address: address || undefined,
          pfpUrl
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add prompt");
      }
      
      const data = await response.json();
      console.log("Prompt added successfully:", data);
      
      // Check if the session is now full after adding this participant
      const updatedSession = data.session;
      const participantCount = Object.keys(updatedSession.participants || {}).length;
      
      if (participantCount >= updatedSession.maxParticipants) {
        console.log("Session is now full, triggering metadata generation...");
        setIsGeneratingMetadata(true);
        
        // First, generate metadata
        try {
          const metadataResponse = await fetch("/api/generate-metadata", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
            }),
          });
          
          if (!metadataResponse.ok) {
            console.error("Failed to generate metadata:", await metadataResponse.text());
            throw new Error("Failed to generate metadata");
          }
          
          console.log("Metadata generation completed successfully");
          setIsGeneratingMetadata(false);
          setIsGeneratingCoin(true);
          
          // Then, create the coin
          const createCoinResponse = await fetch("/api/create-coin-smart", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
            }),
          });
          
          if (!createCoinResponse.ok) {
            console.error("Failed to create coin:", await createCoinResponse.text());
          } else {
            console.log("Coin creation completed successfully");
          }
        } catch (genError) {
          console.error("Error in coin generation process:", genError);
          // Continue to redirect even if coin generation fails
        } finally {
          setIsGeneratingMetadata(false);
          setIsGeneratingCoin(false);
        }
      }
      
      // Check if frame is already added
      const isFrameAdded = context?.client?.added;
      
      if (isFrameAdded) {
        // Frame already added, redirect directly
        router.push(`/session/${sessionId}`);
      } else {
        // Frame not added, show popup
        setJoinedSessionId(sessionId);
        setShowAddFramePopup(true);
      }
    } catch (err) {
      console.error("Error adding prompt:", err);
      setError("Failed to join session. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePopupClose = () => {
    setShowAddFramePopup(false);
    if (joinedSessionId) {
      router.push(`/session/${joinedSessionId}`);
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
  const userHasJoined = !!session.participants?.[userFid];
  const participantCount = Object.keys(session.participants || {}).length;
  const isFull = participantCount >= session.maxParticipants;

  // Get all users with creator first, then others in join order
  const participants = session.participants || {};
  const creatorParticipant = participants[session.creatorFid];
  const otherParticipants = Object.values(participants).filter(p => p.fid !== session.creatorFid);
  const allUsers = creatorParticipant ? [creatorParticipant, ...otherParticipants] : Object.values(participants);

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
    <main className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="max-w-md w-full space-y-8 pb-24">
          {/* Header with logo and user identity */}
          <Header />
                    
          {/* Main Card */}
          <Card className="border bg-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Join Jam Session
              </CardTitle>
              {allUsers.length > 0 && (
                <CardDescription className="text-center pt-2">
                  {participantCount} / {session.maxParticipants} frens have joined:
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Display Joined Users */}
              {session.maxParticipants > 0 && (
                <div className="pb-4">
                  <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: session.maxParticipants }, (_, index) => {
                      const user = allUsers[index];
                      
                      if (user) {
                        return (
                          <div key={`${user.fid}-${index}`} className="flex flex-col items-center space-y-2">
                            <Avatar className="w-20 h-20 border-2 border-border/50 shadow-sm">
                              <AvatarImage 
                                src={user.pfpUrl || "/coinFrens.png"} 
                                alt={user.username || `User ${user.fid}`}
                                className="object-cover"
                              />
                              <AvatarFallback className="text-sm bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                                {(user.username || user.fid).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <button
                              onClick={() => handleViewProfile(typeof user.fid === 'string' && user.fid.startsWith('wallet-') ? undefined : Number(user.fid))}
                              className="text-sm text-center text-muted-foreground font-medium truncate w-full hover:text-primary hover:underline transition-colors cursor-pointer"
                              disabled={typeof user.fid === 'string' && user.fid.startsWith('wallet-')}
                            >
                              {user.username || `User ${user.fid.length > 10 ? user.fid.slice(0, 6) + '...' : user.fid}`}
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <div key={`placeholder-${index}`} className="flex flex-col items-center space-y-2">
                            <div className="w-20 h-20 border-2 border-dashed border-border/30 rounded-full flex items-center justify-center bg-muted/20">
                              <Users className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <span className="text-sm text-muted-foreground/50 font-medium">
                              Waiting...
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

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
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {isGeneratingMetadata ? "Generating coin metadata..." : isGeneratingCoin ? "Launching coin..." : "Joining..."}
                    </>
                  ) : (
                    <>
                      Join
                    </>
                  )}
                </Button>
                
              </form>
            </CardContent>
          </Card>
          
          {/* Back Link */}
          <div className="text-center">
            <Button variant="ghost" asChild className="text-lg">
              <a href="/join" className="group">
                <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back
              </a>
            </Button>
          </div>
        </div>
      </div>

      {showConnectWalletPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm text-center shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Connect Wallet</h3>
            <p className="text-muted-foreground mb-6">
              Please sign in first to join this session.
            </p>
            <Button onClick={() => setShowConnectWalletPrompt(false)} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}

      <AddFramePopup 
        isOpen={showAddFramePopup}
        onClose={handlePopupClose}
      />
    </main>
  );
} 