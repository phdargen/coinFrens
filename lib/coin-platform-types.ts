import { Address, PublicClient, WalletClient } from 'viem';
import { GeneratedMetadata } from './metadata-generator';
import { Participant } from './types';

export type PlatformType = 'zora' | 'flaunch' | 'clanker';

export interface CoinCreationParams {
  metadata: GeneratedMetadata;
  creatorFid: string;
  participants: { [fid: string]: Participant };
  creatorAddress: Address;
}

export interface CoinCreationResult {
  coinAddress: Address;
  txHash: string;
  deployment: any;
  status: "success" | "reverted";
  platform: PlatformType;
}

export interface CoinPlatform {
  createCoin(
    params: CoinCreationParams,
    walletClient: WalletClient,
    publicClient: PublicClient
  ): Promise<CoinCreationResult>;
  
  distributeTokens(
    coinAddress: Address,
    participants: { [fid: string]: Participant },
    walletClient: WalletClient,
    publicClient: PublicClient
  ): Promise<void>;
  
  getPlatformType(): PlatformType;
} 