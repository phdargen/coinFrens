import { CoinSession } from "@/lib/types";
import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, ExternalLink, ShoppingCart, Share2 } from "lucide-react";
import { useViewProfile, useOpenUrl } from '@coinbase/onchainkit/minikit';
import { useBalance } from 'wagmi';
import { useAccount } from 'wagmi';
import { CollectModal } from './CollectModal';
import { sdk } from '@farcaster/frame-sdk';

// Referrer address for Zora links
const ZORA_REFERRER = process.env.INTEGRATOR_WALLET_ADDRESS;
const getZoraUrl = (coinAddress: string) => `https://zora.co/coin/base:${coinAddress}?referrer=${ZORA_REFERRER}`;

interface CompletedCoinsListProps {
  sessions: CoinSession[];
}

export function CompletedCoinsList({ sessions }: CompletedCoinsListProps) {
  const viewProfile = useViewProfile();
  const openUrl = useOpenUrl();
  const { address } = useAccount();
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<CoinSession | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  
  // Get ETH balance - only after component mounts
  const { data: ethBalance } = useBalance({
    address: address,
    query: {
      enabled: mounted && !!address,
    },
  });

  // Ensure component is mounted before rendering client-specific content
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleViewProfile = useCallback((fid: number | undefined) => {
    if (fid) {
      viewProfile(fid);
    }
  }, [viewProfile]);

  const handleCollectClick = useCallback((session: CoinSession) => {
    setSelectedCoin(session);
    setCollectModalOpen(true);
  }, []);

  const handleShare = useCallback((session: CoinSession) => {
    if (!session.metadata?.coinAddress) return;
    
    const zoraUrl = getZoraUrl(session.metadata.coinAddress);
    
    // Get all participants
    const participants = session.participants || {};
    const creatorParticipant = participants[session.creatorFid];
    const otherParticipants = Object.values(participants).filter(p => p.fid !== session.creatorFid);
    const allUsers = creatorParticipant ? [creatorParticipant, ...otherParticipants] : Object.values(participants);
    
    // Format participant list with "and" for the last entry
    const formatParticipants = (users: typeof allUsers) => {
      const usernames = users.map(user => `@${user.username || user.fid}`);
      
      if (usernames.length === 0) return '';
      if (usernames.length === 1) return usernames[0];
      if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]}`;
      
      const lastUsername = usernames.pop();
      return `${usernames.join(', ')} and ${lastUsername}`;
    };
    
    const participantsList = formatParticipants(allUsers);
    const text = `Check out ${session.metadata.name} (${session.metadata.symbol}) coined by ${participantsList}!`;
    
    sdk.actions.composeCast({
      text,
      embeds: [zoraUrl]
    });
  }, []);

  const getIpfsImageUrl = (ipfsUri?: string) => {
    if (!ipfsUri) return "/coinFrens.png";
    
    // Handle IPFS URIs
    if (ipfsUri.startsWith("ipfs://")) {
      const hash = ipfsUri.slice(7);
      if (hash) {
        return `https://ipfs.io/ipfs/${hash}`;
      }
    }
    
    // Handle HTTP/HTTPS URLs
    if (ipfsUri.startsWith("http://") || ipfsUri.startsWith("https://")) {
      return ipfsUri;
    }
    
    // Fallback for any other format
    return "/coinFrens.png";
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-muted/50 p-4 rounded-full">
            <Trophy className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <p className="text-muted-foreground">No completed coins yet.</p>
        <p className="text-sm text-muted-foreground/70">
          Join sessions to help create amazing coins!
        </p>
      </div>
    );
  }

  // Show loading state until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="grid gap-6">
          {sessions.map((session) => (
            <Card key={session.id} className="border bg-gradient-to-br from-muted/30 to-muted/10">
              <CardHeader className="text-center pb-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-border/50 shadow-lg bg-gradient-to-br from-primary/20 to-primary/5">
                    <div className="w-full h-full bg-muted/50 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-6 w-32 bg-muted/50 animate-pulse rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col items-center space-y-2">
                      <div className="w-20 h-20 bg-muted/50 animate-pulse rounded-full" />
                      <div className="h-4 w-16 bg-muted/50 animate-pulse rounded" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="flex-1 h-9 bg-muted/50 animate-pulse rounded" />
                  <div className="flex-1 h-9 bg-muted/50 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-6">
        {sessions.map((session) => {
          const { metadata } = session;
          // Get all users with creator first, then others in join order
          const participants = session.participants || {};
          const creatorParticipant = participants[session.creatorFid];
          const otherParticipants = Object.values(participants).filter(p => p.fid !== session.creatorFid);
          const allUsers = creatorParticipant ? [creatorParticipant, ...otherParticipants] : Object.values(participants);
          
          return (
            <Card key={session.id} className="border bg-gradient-to-br from-muted/30 to-muted/10 hover:from-muted/40 hover:to-muted/20 transition-all duration-300 hover:shadow-lg">
              <CardHeader className="text-center pb-4">
                <div className="flex flex-col items-center space-y-4">
                  {/* Coin Image - Double size */}
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-border/50 shadow-lg bg-gradient-to-br from-primary/20 to-primary/5">
                    <Image
                      src={getIpfsImageUrl(metadata?.ipfsImageUri) || metadata?.imageUrl || "/coinFrens.png"}
                      alt={metadata?.name || "Coin"}
                      fill
                      className="object-cover"
                      sizes="192px"
                      priority={false}
                    />
                  </div>
                  
                  {/* Coin Info */}
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-bold">
                      {metadata?.name || "Unnamed Coin"}
                      {metadata?.symbol && (
                        <span className="text-primary ml-2">({metadata.symbol})</span>
                      )}
                    </CardTitle>
                    {metadata?.description && (
                      <CardDescription className="text-sm text-center max-w-sm">
                        {metadata.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Creators Section */}
                <div className="space-y-3">
                  
                  {/* Creators Grid - similar to SessionList but smaller */}
                  <div className="grid grid-cols-3 gap-2">
                    {allUsers.map((user, index) => (
                      <div key={`${user.fid}-${index}`} className="flex flex-col items-center space-y-2">
                        <div className="aspect-square w-full max-w-20">
                          <Avatar className="w-full h-full border-2 border-border/50 shadow-sm">
                            <AvatarImage 
                              src={user.pfpUrl || "/coinFrens.png"} 
                              alt={user.username || `User ${user.fid}`}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-base bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                              {(user.username || user.fid)?.toString().slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <button 
                          onClick={() => handleViewProfile(typeof user.fid === 'string' && user.fid.startsWith('wallet-') ? undefined : Number(user.fid))}
                          className="text-sm text-center text-muted-foreground font-medium truncate w-full hover:text-primary hover:underline transition-colors cursor-pointer"
                        >
                          {user.username || `User ${String(user.fid).length > 10 ? String(user.fid).slice(0, 6) + '...' : user.fid}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  {/* Collect Button - Full Width */}
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={() => handleCollectClick(session)}
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Collect
                  </Button>
                  
                  {/* Bottom Row - Half Width Buttons */}
                  {metadata?.coinAddress && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => {
                          if (!metadata.coinAddress) return;
                          const zoraUrl = getZoraUrl(metadata.coinAddress);
                          openUrl(zoraUrl);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View on Zora
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleShare(session)}
                      >
                        <Share2 className="h-3 w-3" />
                        Share
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Collect Modal */}
      {mounted && (
        <CollectModal
          isOpen={collectModalOpen}
          onClose={() => setCollectModalOpen(false)}
          session={selectedCoin}
          ethBalance={ethBalance?.value}
        />
      )}
    </div>
  );
} 