import { WarpcastService, WarpcastUser } from "@/src/services/warpcastService";

export interface FollowingStatus {
  userFollowsCreator: boolean;
  creatorFollowsUser: boolean;
  areMutualFollows: boolean;
}

export class FollowingChecker {
  private warpcastService: WarpcastService;

  constructor() {
    this.warpcastService = new WarpcastService();
  }

  /**
   * Check the following relationship between a user and session creator
   */
  async checkFollowingStatus(userFid: number, creatorFid: number): Promise<FollowingStatus> {
    try {
      // Get the creator's followers and following lists
      const [creatorFollowers, creatorFollowing] = await Promise.all([
        this.warpcastService.getFollowers(creatorFid),
        this.warpcastService.getFollowing(creatorFid)
      ]);

      // Check if user follows creator (user is in creator's followers list)
      const userFollowsCreator = creatorFollowers.some((follower: WarpcastUser) => follower.fid === userFid);
      
      // Check if creator follows user (user is in creator's following list)
      const creatorFollowsUser = creatorFollowing.users.some((following: WarpcastUser) => following.fid === userFid);

      return {
        userFollowsCreator,
        creatorFollowsUser,
        areMutualFollows: userFollowsCreator && creatorFollowsUser
      };
    } catch (error) {
      console.error("Error checking following status:", error);
      // Return false for all checks if there's an error
      return {
        userFollowsCreator: false,
        creatorFollowsUser: false,
        areMutualFollows: false
      };
    }
  }

  /**
   * Check if a user is allowed to join a session based on the allowedToJoin setting
   */
  async canUserJoinSession(
    userFid: number | string, 
    creatorFid: string, 
    allowedToJoin: "all" | "followers" | "following" | "frens"
  ): Promise<{ canJoin: boolean; reason?: string }> {
    // If allowedToJoin is "all", anyone can join
    if (allowedToJoin === "all") {
      return { canJoin: true };
    }

    // If user is using wallet-only (string FID), they can't join restricted sessions
    if (typeof userFid === "string" && userFid.startsWith("wallet-")) {
      return { 
        canJoin: false, 
        reason: "You need a Farcaster account to join this restricted session" 
      };
    }

    // If creator is using wallet-only, we can't check relationships
    if (typeof creatorFid === "string" && creatorFid.startsWith("wallet-")) {
      return { 
        canJoin: false, 
        reason: "Cannot verify following status with wallet-only creator" 
      };
    }

    const userFidNumber = Number(userFid);
    const creatorFidNumber = Number(creatorFid);

    // Get following status
    const followingStatus = await this.checkFollowingStatus(userFidNumber, creatorFidNumber);

    switch (allowedToJoin) {
      case "followers":
        if (!followingStatus.userFollowsCreator) {
          return { 
            canJoin: false, 
            reason: "Follow session creator to join" 
          };
        }
        break;

      case "following":
        if (!followingStatus.creatorFollowsUser) {
          return { 
            canJoin: false, 
            reason: "Session creator doesn't follow you" 
          };
        }
        break;

      case "frens":
        if (!followingStatus.areMutualFollows) {
          return { 
            canJoin: false, 
            reason: "You and session creator have to follow each other" 
          };
        }
        break;

      default:
        return { canJoin: true };
    }

    return { canJoin: true };
  }
}

// Export a singleton instance for easy use
export const followingChecker = new FollowingChecker(); 