export type CoinMetadata = {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  coinAddress?: string;
  txHash?: string;
  deployment?: any;
  ipfsImageUri?: string;
  ipfsMetadataUri?: string;
};

export type Participant = {
  fid: string;
  username?: string;
  address?: string;
  pfpUrl?: string;
  prompt: string;
};

export type CoinSession = {
  id: string;
  creatorFid: string;
  creatorName?: string;
  createdAt: number;
  participants: { [fid: string]: Participant };
  maxParticipants: number;
  status: "pending" | "generating" | "complete";
  metadata?: CoinMetadata;
}; 