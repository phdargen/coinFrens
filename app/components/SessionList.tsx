import { CoinSession } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

interface SessionListProps {
  sessions: CoinSession[];
  onRefresh?: () => void;
  showRefresh?: boolean;
  userFid?: string;
}

export function SessionList({ sessions, onRefresh, showRefresh = true, userFid }: SessionListProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleJoin = (sessionId: string) => {
    router.push(`/join/${sessionId}`);
  };

  if (sessions.length === 0) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <p>No active sessions available.</p>
        {showRefresh && onRefresh && (
          <button 
            className="mt-2 px-4 py-2 bg-primary text-white rounded-md"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showRefresh && onRefresh && (
        <div className="flex justify-end">
          <button 
            className="px-4 py-2 bg-primary text-white rounded-md"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      )}
      
      <div className="grid gap-4">
        {sessions.map((session) => {
          const participantCount = Object.keys(session.participants || {}).length;
          const spotsLeft = session.maxParticipants - participantCount;
          const userHasJoined = userFid ? !!session.participants?.[userFid] : false;
          const isFull = participantCount >= session.maxParticipants;
          
          // Get participants with usernames, excluding the creator
          const participantsList = Object.values(session.participants || {})
            .filter(p => p.username && p.fid !== session.creatorFid);
          
          // Get all users including creator for profile pictures
          const allUsers = Object.values(session.participants || {});
          const creatorUser = allUsers.find(p => p.fid === session.creatorFid);
          
          return (
            <div 
              key={session.id} 
              className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex justify-between items-center"
            >
              <div>
                <div className="font-medium">Session #{session.id}</div>
                <div className="text-sm">
                  Created by {session.creatorName || `User #${session.creatorFid}`}
                </div>
                {participantsList.length > 0 && (
                  <div className="text-sm mt-1">
                    Joined by: {participantsList.map(p => p.username).join(", ")}
                  </div>
                )}
                <div className="text-sm mt-1">
                  {participantCount} participant{participantCount !== 1 ? "s" : ""} 
                  {spotsLeft > 0 ? ` (${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left)` : " (Full)"}
                </div>
                
                {/* Profile pictures row */}
                <div className="flex mt-2 space-x-2 overflow-hidden">
                  {allUsers.map((user, index) => (
                    <div 
                      key={`${user.fid}-${index}`} 
                      className={`inline-block h-8 w-8 rounded-full`}
                    >
                      <img
                        src={user.pfpUrl || "/coinFrens.png"}
                        alt={user.username || `User ${user.fid}`}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <button
                className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50"
                onClick={() => handleJoin(session.id)}
                disabled={isFull || userHasJoined}
              >
                {userHasJoined ? "Joined" : "Join"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
} 