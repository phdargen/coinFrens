import { CoinSession } from "@/lib/types";
import { useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Trophy, ExternalLink } from "lucide-react";
import { useViewProfile, useOpenUrl } from '@coinbase/onchainkit/minikit';

interface CompletedCoinsListProps {
  sessions: CoinSession[];
}

export function CompletedCoinsList({ sessions }: CompletedCoinsListProps) {
  const viewProfile = useViewProfile();
  const openUrl = useOpenUrl();
  
  // Referrer address for Zora links
  const ZORA_REFERRER = "0xda641da2646a3c08f7689077b99bacd7272ba0aa";

  const handleViewProfile = useCallback((fid: number | undefined) => {
    if (fid) {
      viewProfile(fid);
    }
  }, [viewProfile]);

  const getIpfsImageUrl = (ipfsUri?: string) => {
    if (!ipfsUri) return "/coinFrens.png";
    if (ipfsUri.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${ipfsUri.slice(7)}`;
    }
    return ipfsUri;
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

  return (
    <div className="space-y-4">
      <div className="grid gap-6">
        {sessions.map((session) => {
          const { metadata } = session;
          const allUsers = Object.values(session.participants || {});
          
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
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/coinFrens.png";
                      }}
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
                  <div className="grid grid-cols-4 gap-3">
                    {allUsers.map((user, index) => (
                      <div key={`${user.fid}-${index}`} className="flex flex-col items-center space-y-2">
                        <div className="aspect-square w-full max-w-16">
                          <Avatar className="w-full h-full border-2 border-border/50 shadow-sm">
                            <AvatarImage 
                              src={user.pfpUrl || "/coinFrens.png"} 
                              alt={user.username || `User ${user.fid}`}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-sm bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                              {(user.username || user.fid).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <button 
                          onClick={() => handleViewProfile(typeof user.fid === 'string' && user.fid.startsWith('wallet-') ? undefined : Number(user.fid))}
                          className="text-xs text-center text-muted-foreground font-medium truncate w-full hover:text-primary hover:underline transition-colors cursor-pointer"
                        >
                          {user.username || `User ${user.fid.length > 10 ? user.fid.slice(0, 6) + '...' : user.fid}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {metadata?.coinAddress && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        const zoraUrl = `https://zora.co/coin/base:${metadata.coinAddress}?referrer=${ZORA_REFERRER}`;
                        openUrl(zoraUrl);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Zora
                    </Button>
                  )}
                  {metadata?.ipfsMetadataUri && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        const ipfsUrl = `https://ipfs.io/ipfs/${metadata.ipfsMetadataUri!.replace('ipfs://', '')}`;
                        openUrl(ipfsUrl);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Metadata
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 