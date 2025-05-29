import { Address, type Hex } from "viem";
import { TypedData, TypedDataDomain } from "abitype";

export interface EIP712TypedData {
  types: TypedData;
  domain: TypedDataDomain;
  message: {
    [key: string]: unknown;
  };
  primaryType: string;
}

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
  status: "pending" | "generating" | "complete" | "txFailed";
  metadata?: CoinMetadata;
  addPfps?: boolean;
  style?: string;
  allowedToJoin?: "all" | "followers" | "following" | "frens";
  minTalentScore?: number | null;
};

export type PlatformStats = {
  createdCoins: number;
  createdSessions: number;
  lastUpdated: number;
}; 

// This interface is subject to change as the API V2 endpoints aren't finalized.
export interface PriceResponse {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  allowanceTarget?: Address;
  gas: string;
  gasPrice: string;
  route: unknown[];
  fees: {
    integratorFee: {
      amount: string;
      token: string;
      type: "volume" | "gas";
    } | null;
    zeroExFee: {
      billingType: "on-chain" | "off-chain";
      feeAmount: string;
      feeToken: Address;
      feeType: "volume" | "gas";
    };
    gasFee: null;
  } | null;
  auxiliaryChainData?: {
    l1GasEstimate?: number;
  };
  blockNumber?: string;
  minBuyAmount?: string;
  tokenMetadata?: {
    buyToken: {
      buyTaxBps: string | null;
      sellTaxBps: string | null;
    };
    sellToken: {
      buyTaxBps: string | null;
      sellTaxBps: string | null;
    };
  };
  issues?: unknown[];
  liquidityAvailable?: boolean;
  totalNetworkFee?: string;
  zid?: string;
}

// This interface is subject to change as the API V2 endpoints aren't finalized.
export interface QuoteResponse {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  buyAmount: string;
  allowanceTarget?: Address;
  gasPrice: string;
  gas: string;
  to: Address;
  data: Hex;
  value: string;
  route: unknown[];
  fees: {
    integratorFee: {
      amount: string;
      token: string;
      type: "volume" | "gas";
    } | null;
    zeroExFee: {
      billingType: "on-chain" | "off-chain";
      feeAmount: string;
      feeToken: Address;
      feeType: "volume" | "gas";
    };
    gasFee: null;
  } | null;
  auxiliaryChainData?: Record<string, unknown>;
  permit2: {
    type: "Permit2";
    hash: Hex;
    eip712: EIP712TypedData;
  };
  transaction: V2QuoteTransaction;
  tokenMetadata?: {
    buyToken: {
      buyTaxBps: string | null;
      sellTaxBps: string | null;
    };
    sellToken: {
      buyTaxBps: string | null;
      sellTaxBps: string | null;
    };
  };
  blockNumber?: string;
  minBuyAmount?: string;
  issues?: unknown[];
  liquidityAvailable?: boolean;
  totalNetworkFee?: string;
  zid?: string;
}

export interface V2QuoteTransaction {
  data: Hex;
  gas: string | null;
  gasPrice: string;
  to: Address;
  value: string;
}