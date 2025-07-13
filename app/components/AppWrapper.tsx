"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { base } from "viem/chains";
import { 
  Transaction, 
  TransactionStatus, 
  TransactionStatusAction, 
  TransactionStatusLabel, 
  TransactionToast, 
  TransactionToastAction, 
  TransactionToastLabel, 
  TransactionToastIcon, 
  TransactionResponse, 
  TransactionError 
} from '@coinbase/onchainkit/transaction';
import { BottomNavigation } from "./BottomNavigation";

interface AppWrapperProps {
  children: React.ReactNode;
}

// Global transaction state
interface TransactionState {
  isActive: boolean;
  step: string;
  error: string;
  txHash: string;
  amount: string;
  startTime: number | null;
}

interface TransactionContextType {
  transactionState: TransactionState;
  clearTransactionState: () => void;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export const useTransactionContext = () => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactionContext must be used within TransactionProvider');
  }
  return context;
};

export function AppWrapper({ children }: AppWrapperProps) {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'completed'>('join');
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  // Global transaction state
  const [transactionState, setTransactionState] = useState<TransactionState>({
    isActive: false,
    step: "",
    error: "",
    txHash: "",
    amount: "",
    startTime: null
  });

  // Track processed transactions
  const processedTxHashes = useRef<Set<string>>(new Set());

  const networkChainId = base.id;
  const fid = context?.user?.fid;
  const username = context?.user?.username;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Update active tab based on current route
  useEffect(() => {
    if (pathname === '/') {
      setActiveTab('join');
    } else if (pathname === '/create') {
      setActiveTab('create');
    } else if (pathname.startsWith('/join/') || pathname.startsWith('/session/')) {
      setActiveTab('join');
    } else if (pathname === '/completed') {
      setActiveTab('completed');
    }
  }, [pathname]);

  // Handle tab changes and navigate accordingly
  const handleTabChange = (tab: 'create' | 'join' | 'completed') => {
    setActiveTab(tab);
    if (tab === 'create') {
      router.push('/create');
    } else if (tab === 'join') {
      router.push('/');
    } else if (tab === 'completed') {
      router.push('/completed');
    }
  };

  // Clear transaction state
  const clearTransactionState = useCallback(() => {
    setTransactionState({
      isActive: false,
      step: "",
      error: "",
      txHash: "",
      amount: "",
      startTime: null
    });
  }, []);

  // Simple transaction calls - send 0 ETH to self for testing
  const transactionCalls = useMemo(() => address ? [
    {
      to: address,
      data: "0x" as `0x${string}`,
      value: BigInt(0),
    },
  ] : [], [address]);

  const handleTransactionSuccess = useCallback(async (response: TransactionResponse) => {
    console.log("Transaction successful:", response);
    const txHash = response.transactionReceipts[0]?.transactionHash;
    
    if (txHash) {
      setTransactionState(prev => ({ 
        ...prev, 
        step: "✅ Transaction successful!",
        txHash,
        isActive: false 
      }));
    }
  }, []);

  const handleTransactionError = useCallback((error: TransactionError) => {
    console.error("Transaction failed:", error);
    setTransactionState(prev => ({ 
      ...prev, 
      step: "❌ Transaction failed",
      error: error.message || "Transaction failed",
      isActive: false 
    }));
  }, []);

  // Show navigation on main pages, join pages, and session pages
  // Only show after mounted and frame is ready
  const showNavigation = mounted && isFrameReady;

  return (
    <TransactionContext.Provider value={{ transactionState, clearTransactionState }}>
      {/* ❶ Stable Transaction component mounted once at app-shell level */}
      {mounted && address && (
        <Transaction
          chainId={base.id}
          calls={transactionCalls}
          onSuccess={handleTransactionSuccess}
          onError={handleTransactionError}
          onStatus={(status) => {
            console.log("Transaction status:", status);
            // Update global transaction step based on status
            if (status.statusName === "init") {
              setTransactionState(prev => ({ 
                ...prev, 
                step: "🔄 Transaction initiated...",
                isActive: true,
                startTime: Date.now(),
                error: ""
              }));
            } else if (status.statusName === "buildingTransaction") {
              setTransactionState(prev => ({ ...prev, step: "🔧 Building transaction..." }));
            } else if (status.statusName === "transactionPending") {
              setTransactionState(prev => ({ ...prev, step: "⏳ Transaction pending on blockchain..." }));
            } else if (status.statusName === "success") {
              setTransactionState(prev => ({ ...prev, step: "✅ Transaction successful!" }));
            } else if (status.statusName === "error") {
              setTransactionState(prev => ({ ...prev, step: "❌ Transaction error occurred" }));
            } else {
              setTransactionState(prev => ({ ...prev, step: `📊 Status: ${status.statusName}` }));
            }
          }}
        >
          <TransactionStatus>
            <TransactionStatusAction />
            <TransactionStatusLabel />
          </TransactionStatus>
          <TransactionToast className="mb-4">
            <TransactionToastIcon />
            <TransactionToastLabel />
            <TransactionToastAction />
          </TransactionToast>
        </Transaction>
      )}

      {children}
      
      {showNavigation && (
        <BottomNavigation 
          activeTab={activeTab} 
          setActiveTab={handleTabChange}
        />
      )}
    </TransactionContext.Provider>
  );
} 