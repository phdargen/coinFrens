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
import { followingChecker } from "@/lib/following-utils";
import { MAX_PROMPT_LENGTH } from "@/src/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, ArrowLeft, Sparkles, ShieldCheck, BarChartBig, Image as ImageIcon } from "lucide-react";
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
  const [isPostingToSocials, setIsPostingToSocials] = useState(false);
  const [joinPermission, setJoinPermission] = useState<{ canJoin: boolean; reason?: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const sessionId = params.id;

  // Add client-side mount check to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Check join permissions when session or user context changes
  useEffect(() => {
    // Don't run permission check until component is mounted
    if (!isMounted || !session) return;

    const checkJoinPermission = async () => {
      const getUserFidForPermission = () => {
        if (context) {
          return getFarcasterUserId(context);
        }
        
        if (process.env.NODE_ENV === 'development') {
          return "372088"; // Use creator FID for testing in dev mode
        }
        
        return address ? `wallet-${address}` : "";
      };

      const userFid = getUserFidForPermission();

      if (!userFid) {
        setJoinPermission({ canJoin: false, reason: "Farcaster account not connected" });
        return;
      }

      // Check if user has already joined
      if (session.participants?.[userFid]) {
        setJoinPermission({ canJoin: false, reason: "Already joined" });
        return;
      }

      // Check if user is allowed to join based on allowedToJoin setting
      if (session.allowedToJoin && session.allowedToJoin !== "all") {
        try {
          const joinCheck = await followingChecker.canUserJoinSession(
            userFid,
            session.creatorFid,
            session.allowedToJoin
          );
          setJoinPermission(joinCheck);
        } catch (followError) {
          console.error("Error checking following status:", followError);
          setJoinPermission({ canJoin: false, reason: "Unable to verify join permissions" });
        }
      } else {
        setJoinPermission({ canJoin: true });
      }
    };

    checkJoinPermission();
  }, [session, context, address, isMounted]);

  // Handle redirect when user has already joined
  useEffect(() => {
    if (!isMounted || !session) return;

    const getUserFid = () => {
      if (context) {
        return getFarcasterUserId(context);
      }
      
      if (process.env.NODE_ENV === 'development') {
        return "372088"; // Use creator FID for testing in dev mode
      }
      
      return address ? `wallet-${address}` : "";
    };

    const userFid = getUserFid();
    const userHasJoined = !!session.participants?.[userFid];

    if (userHasJoined) {
      router.push(`/session/${sessionId}`);
    }
  }, [session, context, address, isMounted, router, sessionId]);

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
    
    // Require both wallet connection and Farcaster context
    if (!address || !context) {
      setShowConnectWalletPrompt(true);
      return;
    }
    
    const getUserFidForSubmit = () => {
      if (context) {
        return getFarcasterUserId(context);
      }
      
      if (process.env.NODE_ENV === 'development') {
        return "372088"; // Use creator FID for testing in dev mode
      }
      
      return address ? `wallet-${address}` : "";
    };

    const userFid = getUserFidForSubmit();
    const username = context ? getFarcasterUsername(context) : address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : undefined;
    const pfpUrl = context?.user?.pfpUrl;
    
    if (!userFid) {
      setError("Unable to identify your account");
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
            
            // Get the coin creation result
            const coinResult = await createCoinResponse.json();
            
            setIsGeneratingCoin(false);
            setIsPostingToSocials(true);
            
            // Post to Farcaster announcing the coin launch
            try {
              console.log("Posting coin launch announcement to Farcaster...");
              const farcasterResponse = await fetch("/api/post-to-farcaster", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId,
                  coinAddress: coinResult.metadata?.coinAddress,
                  coinName: coinResult.metadata?.name,
                  coinSymbol: coinResult.metadata?.symbol,
                  participants: updatedSession.participants,
                }),
              });

              if (farcasterResponse.ok) {
                const farcasterData = await farcasterResponse.json();
                console.log("Successfully posted to Farcaster:", farcasterData);
              } else {
                const error = await farcasterResponse.json().catch(() => null);
                console.error("Failed to post to Farcaster:", farcasterResponse.status, error);
              }
            } catch (farcasterError) {
              console.error("Error posting to Farcaster:", farcasterError);
              // Don't fail the entire process if Farcaster posting fails
            }

            // Post to Twitter announcing the coin launch
            try {
              console.log("Posting coin launch announcement to Twitter...");
              const twitterResponse = await fetch("/api/post-to-twitter", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId,
                  coinAddress: coinResult.metadata?.coinAddress,
                  coinName: coinResult.metadata?.name,
                  coinSymbol: coinResult.metadata?.symbol,
                  participants: updatedSession.participants,
                }),
              });

              if (twitterResponse.ok) {
                const twitterData = await twitterResponse.json();
                console.log("Successfully posted to Twitter:", twitterData);
              } else {
                const error = await twitterResponse.json().catch(() => null);
                console.error("Failed to post to Twitter:", twitterResponse.status, error);
              }
            } catch (twitterError) {
              console.error("Error posting to Twitter:", twitterError);
              // Don't fail the entire process if Twitter posting fails
            }
          }
        } catch (genError) {
          console.error("Error in coin generation process:", genError);
          // Continue to redirect even if coin generation fails
        } finally {
          setIsGeneratingMetadata(false);
          setIsGeneratingCoin(false);
          setIsPostingToSocials(false);
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

  // Don't calculate user-dependent values until component is mounted to prevent hydration errors
  if (!isMounted) {
    return <LoadingComponent text="Loading..." />;
  }

  // Get all users with creator first, then others in join order
  const participants = session.participants || {};
  const creatorParticipant = participants[session.creatorFid];
  const otherParticipants = Object.values(participants).filter(p => p.fid !== session.creatorFid);
  const allUsers = creatorParticipant ? [creatorParticipant, ...otherParticipants] : Object.values(participants);

  // Calculate userFid with development fallback
  const getUserFid = () => {
    if (context) {
      return getFarcasterUserId(context);
    }
    
    if (process.env.NODE_ENV === 'development') {
      return "372088"; // Use creator FID for testing in dev mode
    }
    
    return address ? `wallet-${address}` : "";
  };

  const userFid = getUserFid();
  const userHasJoined = !!session.participants?.[userFid];
  const participantCount = Object.keys(session.participants || {}).length;
  const isFull = participantCount >= session.maxParticipants;

  // Determine if any non-default settings are active for display
  const hasCustomStyle = session.style && session.style !== "None";
  const hasPfpsInPrompt = !!session.addPfps;
  const hasRestrictedJoin = session.allowedToJoin && session.allowedToJoin !== "all";
  const hasMinTalentScore = session.minTalentScore !== undefined && session.minTalentScore !== null && session.minTalentScore > 0;
  const showSettingsIndicators = hasCustomStyle || hasPfpsInPrompt || hasRestrictedJoin || hasMinTalentScore;

  // Show loading while redirecting for users who have already joined
  if (userHasJoined) {
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
              {/* Session Settings Indicators (conditionally rendered) */}
              {showSettingsIndicators && (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-4 mb-4 border-b border-border/20 text-xs text-muted-foreground">
                  {hasCustomStyle && (
                    <div className="flex items-center">
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-primary/80" />
                      {session.style === "Custom" ? "Custom Style" : session.style}
                    </div>
                  )}
                  {hasPfpsInPrompt && (
                    <div className="flex items-center">
                      <ImageIcon className="h-3.5 w-3.5 mr-1 text-primary/80" />
                      Add PFPs
                    </div>
                  )}
                  {hasRestrictedJoin && (
                    <div className="flex items-center">
                      <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary/80" />
                      {session.allowedToJoin === "followers" && "Followers Only"}
                      {session.allowedToJoin === "following" && "Following Only"}
                      {session.allowedToJoin === "frens" && "Frens Only"}
                    </div>
                  )}
                  {hasMinTalentScore && (
                    <div className="flex items-center">
                      <BarChartBig className="h-3.5 w-3.5 mr-1 text-primary/80" />
                      Talent {'>'} {session.minTalentScore}
                    </div>
                  )}
                </div>
              )}

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
                  All prompts of a Jam Session will be combined to create your coin.
                  0.9% of the total supply will be fairly distributed to all frens.                  </p>
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !joinPermission?.canJoin}
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {isGeneratingMetadata ? "Generating coin metadata ..." : 
                       isGeneratingCoin ? "Launching coin..." : 
                       isPostingToSocials ? "Coin launched 🚀! Announcing on socials ...." : 
                       "Joining..."}
                    </>
                  ) : (
                    <>
                      {!joinPermission ? "Loading..." : 
                       joinPermission.canJoin ? "Join" : 
                       joinPermission.reason ? `Join (${joinPermission.reason})` : "Join"}
                    </>
                  )}
                </Button>
                
                {isSubmitting && (
                  <p className="text-destructive text-sm text-center font-medium mt-2">
                    Please keep the app open!
                  </p>
                )}
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
            <h3 className="text-lg font-semibold mb-4 text-foreground">Connection Required</h3>
            <p className="text-muted-foreground mb-6">
              Please connect both your wallet and Farcaster account to join this session.
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