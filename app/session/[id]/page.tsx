"use client";

import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useOpenUrl } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { CoinSession } from "@/lib/types";
import { LoadingComponent, ErrorComponent } from "@/app/components/UIComponents";
import { Header } from "@/app/components/Header";
import { getFarcasterUserId } from "@/lib/farcaster-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowLeft, ExternalLink, CheckCircle, Clock, Loader2 } from "lucide-react";
import Image from "next/image";

export default function SessionPage({ params }: { params: { id: string } }) {
  const { context } = useMiniKit();
  const openUrl = useOpenUrl();
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
  const userHasJoined = !!session.participants?.[userFid];
  const participantCount = Object.keys(session.participants || {}).length;
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
    <main className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="max-w-md w-full space-y-8 pb-24">
          {/* Header with logo and user identity */}
          <Header />
          
          {/* Session Info */}
          <div className="text-center">
            <Badge variant="secondary" className="text-primary">
              Session #{session.id}
            </Badge>
          </div>
          
          {/* Session Status Card */}
          <Card className="border bg-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Session Status
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Creator Info */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Creator</p>
                <p className="font-medium">{formatCreatorInfo()}</p>
              </div>
              
              {/* Participants Info */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Participants</p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {participantCount} of {session.maxParticipants} joined
                    {remainingSpots > 0 && ` (${remainingSpots} spots remaining)`}
                  </span>
                </div>
              </div>
              
              {/* Status */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  {session.status === "pending" && (
                    <>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">
                        Waiting for participants...
                      </Badge>
                    </>
                  )}
                  {session.status === "generating" && (
                    <>
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <Badge variant="secondary" className="text-primary">
                        Generating coin metadata...
                      </Badge>
                    </>
                  )}
                  {session.status === "complete" && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary" className="text-green-600">
                        Coin metadata generated!
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              
              {!userHasJoined && session.status === "pending" && (
                <div className="pt-4">
                  <Button asChild className="w-full" size="lg">
                    <a href={`/join/${session.id}`}>
                      Join This Session
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Coin Preview Card */}
          {session.status === "complete" && session.metadata && (
            <Card className="border bg-card">
              <CardHeader className="text-center pb-4">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Image 
                    src="/coinFrens.png" 
                    alt="CoinFrens Logo" 
                    width={20} 
                    height={20}
                    className="h-5 w-5"
                  />
                  Your Coin
                </CardTitle>
                <CardDescription>
                  Collaborative creation complete!
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-center space-y-3">
                  <h3 className="text-2xl font-bold">{session.metadata.name}</h3>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    ${session.metadata.symbol}
                  </Badge>
                  <p className="text-muted-foreground text-sm">
                    {session.metadata.description}
                  </p>
                </div>
                
                {session.metadata.ipfsImageUri && (
                  <div className="flex justify-center">
                    <img 
                      src={session.metadata.ipfsImageUri.replace('ipfs://', 'https://ipfs.io/ipfs/')} 
                      alt={session.metadata.name}
                      className="max-w-full rounded-md max-h-48"
                    />
                  </div>
                )}
                
                <Button
                  onClick={() => session.metadata?.coinAddress ? openUrl(`https://zora.co/coin/base:${session.metadata.coinAddress}?referrer=0xda641da2646a3c08f7689077b99bacd7272ba0aa`) : null}
                  className="w-full bg-[#6A39EC] hover:bg-[#5A2BD8]"
                  size="lg"
                >
                  <span>View on Zora</span>
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Back Link */}
          <div className="text-center">
            <Button variant="ghost" asChild className="text-lg">
              <a href="/join" className="group">
                <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to all sessions
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
} 