export interface WarpcastUser {
  fid: number;
  displayName: string;
  profile: {
    bio: { text: string; mentions: any[] };
    channelMentions: any[];
    location: { placeId: string; description: string };
    earlyWalletAdopter: boolean;
  };
  username: string;
  followerCount: number;
  followingCount: number;
  pfp: { url: string };
  verified: boolean;
  referrerUsername: string;
  viewerContext: {
    following: boolean;
    followedBy: boolean;
    enableNotifications: boolean;
  };
}

export class WarpcastService {
  // Point to Next.js internal proxy to avoid CORS
  private baseUrl = '/api/warpcast';

  private async fetchPage<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path, window.location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.append(k, String(v));
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<T>;
  }

  /** Get all followers by paginating until there's no more cursor */
  async getFollowers(fid: number): Promise<WarpcastUser[]> {
    return this._collectAllPages(cursor =>
      this.fetchPage<{
        result: { users: WarpcastUser[] };
        next?: { cursor: string };
      }>('/v2/followers', { fid, cursor }).then(d => ({
        users: d.result.users,
        nextCursor: d.next?.cursor
      }))
    );
  }

  /** Get all following users + leastInteracted only from first page */
  async getFollowing(fid: number): Promise<{
    users: WarpcastUser[];
    leastInteracted: { count: number; users: WarpcastUser[] };
  }> {
    let leastInteracted = { count: 0, users: [] as WarpcastUser[] };

    const users = await this._collectAllPages(cursor =>
      this.fetchPage<{
        result: {
          users: WarpcastUser[];
          leastInteractedWith?: { count: number; users: WarpcastUser[] };
        };
        next?: { cursor: string };
      }>('/v2/following', { fid, cursor }).then(d => {
        if (!leastInteracted.users.length && d.result.leastInteractedWith) {
          leastInteracted = d.result.leastInteractedWith;
        }
        return {
          users: d.result.users,
          nextCursor: d.next?.cursor
        };
      })
    );

    return { users, leastInteracted };
  }

  /** Helper: iterate through all pages until nextCursor is undefined */
  private async _collectAllPages(
    fetchPage: (cursor?: string) => Promise<{ users: WarpcastUser[]; nextCursor?: string }>
  ): Promise<WarpcastUser[]> {
    const all: WarpcastUser[] = [];
    let cursor: string | undefined = undefined;
    do {
      const { users, nextCursor } = await fetchPage(cursor);
      all.push(...users);
      cursor = nextCursor;
    } while (cursor);
    return all;
  }
} 