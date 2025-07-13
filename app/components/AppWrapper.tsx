"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
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

  // Global transaction calls function
  const getTransactionCalls = useCallback(async () => {
    console.log("🔄 Global getTransactionCalls called - creating simple test transaction");
    
    if (!address) {
      const errorMsg = `Missing wallet address: ${address}`;
      console.error("❌", errorMsg);
      setTransactionState(prev => ({ ...prev, step: `❌ ${errorMsg}`, error: errorMsg }));
      throw new Error(errorMsg);
    }

    setTransactionState(prev => ({ ...prev, step: "🔄 Creating simple test transaction..." }));
    
    try {
      // Simple 0 ETH transfer to self for testing
      const calls = [
        {
          to: address as `0x${string}`,
          data: "0x" as `0x${string}`,
          value: BigInt(0),
        },
      ];
      
      console.log("✅ Simple test transaction calls prepared:", calls);
      setTransactionState(prev => ({ ...prev, step: "✅ Test transaction ready" }));
      return calls;
      
    } catch (error) {
      console.error('❌ Error in getTransactionCalls:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to prepare transaction";
      setTransactionState(prev => ({ 
        ...prev, 
        step: `❌ Transaction prep failed: ${errorMessage}`,
        error: errorMessage 
      }));
      throw error;
    }
  }, [address]);

  // Record transaction
  const recordTransaction = useCallback(async (txHash: string, amount: string = "0") => {
    if (!address && !fid) {
      console.error("No user identifier available for transaction recording");
      return;
    }

    // Skip if this transaction has already been processed
    if (processedTxHashes.current.has(txHash)) {
      console.log(`Transaction ${txHash} already recorded, skipping`);
      return;
    }

    // Add to processed set immediately to prevent duplicate processing
    processedTxHashes.current.add(txHash);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHash,
          coinAddress: "TEST",
          coinName: "Test Transaction",
          coinSymbol: "TEST",
          fid: fid?.toString(),
          username,
          address,
          ethAmount: amount,
          usdAmount: "0",
          action: "test"
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to record transaction');
      } else {
        console.log(`Transaction recorded successfully: ${txHash}`);
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
    }
  }, [address, fid, username]);

  // Handle transaction success
  const handleTransactionSuccess = useCallback(async (response: TransactionResponse) => {
    console.log("🎉 Global transaction success callback triggered");
    
    setTransactionState(prev => ({ ...prev, step: "Success callback received!" }));
    
    try {
      // Extract transaction hash
      let txHash: string | undefined;
      
      if (response.transactionReceipts && response.transactionReceipts.length > 0) {
        txHash = response.transactionReceipts[0].transactionHash;
        console.log("✅ Transaction hash from receipts[0]:", txHash);
        setTransactionState(prev => ({ ...prev, step: `Hash found: ${txHash?.slice(0, 10)}...` }));
      } else {
        console.error("❌ No transaction receipts found in response");
        setTransactionState(prev => ({ ...prev, step: "❌ No transaction hash found" }));
        return;
      }
      
      if (!txHash) {
        console.error("❌ No transaction hash found in response");
        setTransactionState(prev => ({ ...prev, step: "❌ No transaction hash found" }));
        return;
      }
      
      // Set success state
      console.log("🚀 Setting success state with hash:", txHash);
      setTransactionState(prev => ({ 
        ...prev, 
        step: "✅ Transaction successful!",
        txHash,
        isActive: false,
        startTime: null
      }));
      
      // Record transaction
      await recordTransaction(txHash, "0");
      
    } catch (error) {
      console.error('❌ Error handling transaction success:', error);
      setTransactionState(prev => ({ 
        ...prev, 
        step: `❌ Error in success handler: ${error instanceof Error ? error.message : "Unknown error"}` 
      }));
    }
  }, [recordTransaction]);

  // Handle transaction error
  const handleTransactionError = useCallback((error: TransactionError) => {
    console.error("❌ Global transaction failed:", error);
    setTransactionState(prev => ({ 
      ...prev, 
      error: error.message || "Transaction failed",
      step: `❌ Transaction failed: ${error.message || "Unknown error"}`,
      startTime: null
    }));
  }, []);

  // Show navigation on main pages, join pages, and session pages
  // Only show after mounted and frame is ready
  const showNavigation = mounted && isFrameReady;

  return (
    <TransactionContext.Provider value={{ transactionState, clearTransactionState }}>
      {/* ❶ Stable Transaction component mounted once at app-shell level */}
      {mounted && (
        <Transaction
          chainId={base.id}
          calls={getTransactionCalls}
          onSuccess={handleTransactionSuccess}
          onError={handleTransactionError}
          onStatus={(status) => {
            // Update global transaction step based on status
            if (status.statusName === "init") {
              setTransactionState(prev => ({ 
                ...prev, 
                step: "🔄 Transaction initiated...",
                isActive: true,
                startTime: Date.now()
              }));
            } else if (status.statusName === "buildingTransaction") {
              setTransactionState(prev => ({ ...prev, step: "🔧 Building transaction..." }));
            } else if (status.statusName === "transactionPending") {
              setTransactionState(prev => ({ ...prev, step: "⏳ Transaction pending on blockchain..." }));
            } else if (status.statusName === "transactionLegacyExecuted") {
              setTransactionState(prev => ({ ...prev, step: "⚡ Transaction executed (legacy)..." }));
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