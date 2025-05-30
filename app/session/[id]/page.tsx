"use client";

import { useState, useEffect, useCallback } from "react";
import React from "react";
import Image from "next/image";
import { useMiniKit, useViewProfile } from "@coinbase/onchainkit/minikit";
import { useOpenUrl } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { LoadingComponent, ErrorComponent } from "@/app/components/UIComponents";
import { Header } from "@/app/components/Header";
import { getFarcasterUserId } from "@/lib/farcaster-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, ArrowLeft, Share2, ExternalLink, Sparkles, ShieldCheck, BarChartBig, Image as ImageIcon } from "lucide-react";
import { sdk } from '@farcaster/frame-sdk';

export default function SessionPage({ params }: { params: { id: string } }) {
  const { context } = useMiniKit();
  const openUrl = useOpenUrl();
  const viewProfile = useViewProfile();
  const { address } = useAccount();
  const [session, setSession] = useState<CoinSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const handleViewProfile = React.useCallback((fid: number | undefined) => {
    if (fid) {
      viewProfile(fid);
    }
  }, [viewProfile]);

  const handleShare = useCallback(() => {
    if (!session) return;
    
    // Get userFid inside the function to avoid dependency issues
    const currentUserFid = context ? getFarcasterUserId(context) : address ? `wallet-${address}` : "";
    
    // Prepare participant data for the frame
    const participants = session.participants || {};
    const participantArray = Object.values(participants).map(p => ({
      fid: p.fid,
      username: p.username || `User ${p.fid}`,
      pfpUrl: p.pfpUrl || ''
    }));
    
    const participantCount = Object.keys(participants).length;
    const baseUrl = process.env.NEXT_PUBLIC_URL || '';
    
    // Build frame URL with session data
    const frameParams = new URLSearchParams({
      sessionId: sessionId,
      creatorName: session.creatorName || 'Unknown Creator',
      status: session.status,
      maxParticipants: session.maxParticipants.toString(),
      participantCount: participantCount.toString(),
    });
    
    // Add participants data
    if (participantArray.length > 0) {
      frameParams.set('participants', JSON.stringify(participantArray));
    }
    
    // Add coin metadata if session is complete
    if (session.status === "complete" && session.metadata) {
      frameParams.set('coinName', session.metadata.name);
      frameParams.set('coinSymbol', session.metadata.symbol);
      if (session.metadata.ipfsImageUri) {
        frameParams.set('coinImageUrl', session.metadata.ipfsImageUri);
      }
    }
    
    // Fix double slash issue by ensuring baseUrl doesn't end with slash when concatenating
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const frameUrl = `${cleanBaseUrl}/api/frame/session?${frameParams.toString()}`;
    console.log(frameUrl);
    
    if (session.status === "complete" && session.metadata) {
      // For completed coins, share with coin details and custom frame
      const otherParticipants = Object.values(participants)
        .filter(p => p.fid !== session.creatorFid)
        .map(p => p.username || `User ${p.fid}`);
      
      const otherUsersText = otherParticipants.length > 0 
        ? ` with ${otherParticipants.join(', ')}${otherParticipants.length === 3 ? ', ...' : ''}`
        : '';
      
      const text = `I coined ${session.metadata.name} (${session.metadata.symbol})${otherUsersText} with CoinJam.`;
      
      sdk.actions.composeCast({
        text,
        embeds: [frameUrl]
      });
    } else {
      // Incomplete sessions - use custom frame with participant preview
      const remainingSpots = (session?.maxParticipants || 0) - participantCount;
      
      const isCreator = currentUserFid === session.creatorFid;
      const text = isCreator 
        ? `Join my CoinJam session by adding your secret prompt fragment! ${remainingSpots} spots left!`
        : `Join this CoinJam session by ${session.creatorName} and help create an amazing coin! ${remainingSpots} spots left!`;
      
      sdk.actions.composeCast({
        text,
        embeds: [frameUrl]
      });
    }
  }, [session, context, address, sessionId]);

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

  // Get user ID from either Farcaster or wallet
  const userFid = context ? getFarcasterUserId(context) : address ? `wallet-${address}` : "";
  const userHasJoined = !!session.participants?.[userFid];
  const participantCount = Object.keys(session.participants || {}).length;
  const remainingSpots = session.maxParticipants - participantCount;
  
  // Determine if any non-default settings are active for display
  const hasCustomStyle = session.style && session.style !== "None";
  const hasPfpsInPrompt = !!session.addPfps;
  const hasRestrictedJoin = session.allowedToJoin && session.allowedToJoin !== "all";
  const hasMinTalentScore = session.minTalentScore !== undefined && session.minTalentScore !== null && session.minTalentScore > 0;
  const showSettingsIndicators = hasCustomStyle || hasPfpsInPrompt || hasRestrictedJoin || hasMinTalentScore;

  // Get creator information from participants
  const creatorParticipant = session.participants?.[session.creatorFid];
  // Get all users with creator first, then others in join order
  const participants = session.participants || {};
  const otherParticipants = Object.values(participants).filter(p => p.fid !== session.creatorFid);
  const allUsers = creatorParticipant ? [creatorParticipant, ...otherParticipants] : Object.values(participants);

  return (
    <main className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="max-w-md w-full space-y-8 pb-24">
          {/* Header with logo and user identity */}
          <Header />
          
          {/* Session Status Card */}
          <Card className="border bg-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Jam Session created by {session.creatorName}
              </CardTitle>
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
                  <div className="text-sm font-medium text-muted-foreground mb-3 text-center">
                    {participantCount} / {session.maxParticipants} frens have joined:
                  </div>
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

              {/* Coin Preview - integrated directly */}
              {session.status === "complete" && session.metadata && (
                <div className="text-center space-y-4">
                  {/* Coin Image */}
                  <div className="flex justify-center">
                    <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-border/50 shadow-lg bg-gradient-to-br from-primary/20 to-primary/5">
                      <Image
                        src={session.metadata.ipfsImageUri ? session.metadata.ipfsImageUri.replace('ipfs://', 'https://ipfs.io/ipfs/') : "/coinFrens.png"}
                        alt={session.metadata.name || "Coin"}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/coinFrens.png";
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Coin Info */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">
                      {session.metadata.name}
                      {session.metadata.symbol && (
                        <span className="text-primary ml-2">({session.metadata.symbol})</span>
                      )}
                    </h3>
                    {session.metadata.description && (
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        {session.metadata.description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Generating Status */}
              {session.status === "generating" && (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-border/30 rounded-full flex items-center justify-center bg-muted/20">
                      <div className="text-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-muted-foreground font-medium">Generating...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="space-y-3">
                {session.status === "complete" && session.metadata?.coinAddress && (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        if (session.metadata?.coinAddress) {
                          const zoraUrl = `https://zora.co/coin/base:${session.metadata.coinAddress}?referrer=0xda641da2646a3c08f7689077b99bacd7272ba0aa`;
                          openUrl(zoraUrl);
                        }
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Zora
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={handleShare}
                    >
                      <Share2 className="h-3 w-3" />
                      Share
                    </Button>
                  </div>
                )}
                
                {session.status !== "complete" && (
                  <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={handleShare} 
                    variant="default"
                    disabled={session.status === "generating"}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                )}
              </div>
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
    </main>
  );
} 