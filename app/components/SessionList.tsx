import { CoinSession } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Clock, Sparkles, ShieldCheck, BarChartBig, Image as ImageIcon } from "lucide-react";
import { useViewProfile } from '@coinbase/onchainkit/minikit';

interface SessionListProps {
  sessions: CoinSession[];
  userFid?: string;
}

export function SessionList({ sessions, userFid }: SessionListProps) {
  const router = useRouter();
  const viewProfile = useViewProfile();

  const handleJoin = (sessionId: string, userHasJoined: boolean) => {
    if (userHasJoined) {
      router.push(`/session/${sessionId}`);
    } else {
      router.push(`/join/${sessionId}`);
    }
  };

  const handleViewProfile = useCallback((fid: number | undefined) => {
    if (fid) {
      viewProfile(fid);
    }
  }, [viewProfile]);

  if (sessions.length === 0) {
    return (
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-muted/50 p-4 rounded-full">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <p className="text-muted-foreground">No active sessions available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {sessions.map((session) => {
          const participantCount = Object.keys(session.participants || {}).length;
          const spotsLeft = session.maxParticipants - participantCount;
          const userHasJoined = userFid ? !!session.participants?.[userFid] : false;
          const isFull = participantCount >= session.maxParticipants;
          
          // Get all users with creator first, then others in join order
          const participants = session.participants || {};
          const creatorParticipant = participants[session.creatorFid];
          const otherParticipants = Object.values(participants).filter(p => p.fid !== session.creatorFid);
          const allUsers = creatorParticipant ? [creatorParticipant, ...otherParticipants] : Object.values(participants);
          
          // Create placeholder spots for empty participant slots
          const totalSlots = session.maxParticipants;
          const emptySlots = totalSlots - allUsers.length;

          // Determine if any non-default settings are active
          const hasCustomStyle = session.style && session.style !== "None";
          const hasPfpsInPrompt = !!session.addPfps;
          const hasRestrictedJoin = session.allowedToJoin && session.allowedToJoin !== "all";
          const hasMinTalentScore = session.minTalentScore !== undefined && session.minTalentScore !== null && session.minTalentScore > 0;
          const showSettingsIndicators = hasCustomStyle || hasPfpsInPrompt || hasRestrictedJoin || hasMinTalentScore;
          
          return (
            <Card key={session.id} className="border bg-gradient-to-br from-muted/30 to-muted/10 hover:from-muted/40 hover:to-muted/20 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="space-y-4">
                  
                  {/* Large Profile Pictures Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Show actual participants */}
                    {allUsers.map((user, index) => (
                      <div key={`${user.fid}-${index}`} className="flex flex-col items-center space-y-2">
                        <div className="aspect-square w-full">
                          <Avatar className="w-full h-full border-2 border-border/50 shadow-sm">
                            <AvatarImage 
                              src={user.pfpUrl || "/coinFrens.png"} 
                              alt={user.username || `User ${user.fid}`}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                              {(user.username || user.fid).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <button 
                          onClick={() => handleViewProfile(typeof user.fid === 'string' && user.fid.startsWith('wallet-') ? undefined : Number(user.fid))}
                          className="text-xs text-center text-muted-foreground font-medium truncate w-full hover:text-primary hover:underline transition-colors cursor-pointer"
                        >
                          {user.username || `User ${user.fid.length > 10 ? user.fid.slice(0, 8) + '...' : user.fid}`}
                        </button>
                      </div>
                    ))}
                    
                    {/* Show empty slots for remaining participants */}
                    {Array.from({ length: emptySlots }).map((_, index) => (
                      <div key={`empty-${index}`} className="flex flex-col items-center space-y-2">
                        <div className="aspect-square w-full">
                          <div className="w-full h-full border-2 border-dashed border-muted-foreground/30 rounded-full flex items-center justify-center bg-muted/20">
                            <Users className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        </div>
                        <p className="text-xs text-center text-muted-foreground/50 font-medium">
                          Open spot
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Session Settings Indicators (conditionally rendered with the border) */}
                  {showSettingsIndicators && (
                    <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 pt-3 border-t border-border/20 mt-3">
                      {hasCustomStyle && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 mr-1 text-primary/80" />
                          {session.style === "Custom" ? "Custom Style" : session.style}
                        </div>
                      )}
                      {hasPfpsInPrompt && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <ImageIcon className="h-3.5 w-3.5 mr-1 text-primary/80" />
                          Add PFPs
                        </div>
                      )}
                      {hasRestrictedJoin && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary/80" />
                          {session.allowedToJoin === "followers" && "Followers Only"}
                          {session.allowedToJoin === "following" && "Following Only"}
                          {session.allowedToJoin === "frens" && "Frens Only"}
                        </div>
                      )}
                      {hasMinTalentScore && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <BarChartBig className="h-3.5 w-3.5 mr-1 text-primary/80" />
                          Talent {'>'} {session.minTalentScore}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Full-width Join Button */}
                  <Button
                    onClick={() => handleJoin(session.id, userHasJoined)}
                    disabled={isFull && !userHasJoined}
                    size="lg"
                    className={`w-full ${userHasJoined ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
                    variant={userHasJoined ? undefined : "default"}
                  >
                    {userHasJoined ? "✓ Joined" : isFull ? "Session Full" : "Join Session"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 