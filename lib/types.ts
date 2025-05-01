export type CoinMetadata = {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
};

export type CoinSession = {
  id: string;
  creatorFid: string;
  creatorName?: string;
  createdAt: number;
  prompts: { [fid: string]: string };
  maxParticipants: number;
  status: "pending" | "generating" | "complete";
  metadata?: CoinMetadata;
};

export type Participant = {
  fid: string;
  name?: string;
  prompt: string;
}; 