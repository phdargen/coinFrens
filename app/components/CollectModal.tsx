"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Transaction, TransactionButton, TransactionStatus, TransactionStatusAction, LifecycleStatus, TransactionToast, TransactionToastAction, TransactionToastLabel, TransactionToastIcon, TransactionStatusLabel, TransactionResponse, TransactionError } from '@coinbase/onchainkit/transaction';
import { useTokenTransaction } from '@/hooks/useTokenTransaction';
import { useAccount } from 'wagmi';
import { useMiniKit, useOpenUrl } from '@coinbase/onchainkit/minikit';
import { base } from 'viem/chains';
import { CoinSession } from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, CheckCircle, ExternalLink } from "lucide-react";
import { formatEther, parseEther } from "viem";

interface CollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: CoinSession;
  ethBalance?: bigint;
}

export function CollectModal({ 
  isOpen, 
  onClose, 
  session,
  ethBalance 
}: CollectModalProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [selectedAmount, setSelectedAmount] = useState<string>("0.000111");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [successTxHash, setSuccessTxHash] = useState<string>("");
  const [successAmount, setSuccessAmount] = useState<string>("");
  const [transactionCalls, setTransactionCalls] = useState<any[]>([]);
  const [preparingTransaction, setPreparingTransaction] = useState<boolean>(false);
  const [transactionError, setTransactionError] = useState<string>("");
  const [transactionStartTime, setTransactionStartTime] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [transactionStep, setTransactionStep] = useState<string>("");
  
  const { address } = useAccount();
  const { context } = useMiniKit();
  const openUrl = useOpenUrl();
  const networkChainId = base.id;
  
  const fid = context?.user?.fid;
  const username = context?.user?.username;
  
  // Debug: Log client context for debugging
  useEffect(() => {
    console.log("MiniKit context:", {
      client: context?.client,
      user: context?.user,
      address,
      fid,
      username
    });
    
    // Set visual debug info
    const clientInfo = context?.client ? JSON.stringify(context.client) : "Unknown client";
    setDebugInfo(`Client: ${clientInfo} | Address: ${address || "none"} | FID: ${fid || "none"}`);
  }, [context, address, fid, username]);
  
  const coinName = session?.metadata?.name || "Coin";
  const coinSymbol = session?.metadata?.symbol || "COIN";
  const coinAddress = session?.metadata?.coinAddress;

  // Track processed transactions to prevent duplicates
  const processedTxHashes = useRef<Set<string>>(new Set());

  const { handleTokenTransaction } = useTokenTransaction({
    coinAddress,
    ethAmount: selectedAmount
  });

  // Prepare transaction calls when amount or coinAddress changes
  useEffect(() => {
    const prepareTransactionCalls = async () => {
      if (!coinAddress || !address || parseFloat(selectedAmount || "0") <= 0) {
        setTransactionCalls([]);
        return;
      }

      console.log("Preparing transaction calls for:", { coinAddress, address, selectedAmount, networkChainId });
      setPreparingTransaction(true);
      setTransactionError("");
      setTransactionStep("Preparing transaction...");
      try {
        const calls = await handleTokenTransaction(networkChainId);
        console.log("Transaction calls prepared:", calls);
        setTransactionCalls(calls || []);
        setTransactionError("");
        
        // Start monitoring transaction when calls are ready
        if (calls && calls.length > 0) {
          console.log("🔄 Transaction ready to be initiated");
          setTransactionStartTime(Date.now());
          setTransactionStep("✅ Ready - Tap 'Buy' to execute");
        } else {
          setTransactionStep("❌ No transaction calls prepared");
        }
      } catch (error) {
        console.error('Error preparing transaction calls:', error);
        setTransactionCalls([]);
        setTransactionError(error instanceof Error ? error.message : "Failed to prepare transaction");
        setTransactionStep("Preparation failed");
      } finally {
        setPreparingTransaction(false);
      }
    };

    // Only prepare calls when not in success state
    if (!showSuccess && activeTab === "buy") {
      prepareTransactionCalls();
    }
  }, [selectedAmount, coinAddress, address, networkChainId, handleTokenTransaction, showSuccess, activeTab]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false);
      setSuccessTxHash("");
      setSuccessAmount("");
      setSelectedAmount("0.000111");
      setActiveTab("buy");
      setTransactionCalls([]);
      setPreparingTransaction(false);
      setTransactionError("");
      setTransactionStartTime(null);
      setDebugInfo("");
      setTransactionStep("");
    }
  }, [isOpen]);

  // Save processed tx hashes to session storage
  const saveProcessedTxs = useCallback(() => {
    try {
      const txArray = Array.from(processedTxHashes.current);
      sessionStorage.setItem('processedCoinTransactionTxs', JSON.stringify(txArray));
    } catch (error) {
      console.error('Error saving processed transactions:', error);
    }
  }, []);

  // Load saved transactions from session storage on mount
  useEffect(() => {
    try {
      const savedTxs = sessionStorage.getItem('processedCoinTransactionTxs');
      if (savedTxs) {
        const txArray = JSON.parse(savedTxs);
        if (Array.isArray(txArray)) {
          processedTxHashes.current = new Set(txArray);
        }
      }
    } catch (error) {
      console.error('Error loading saved transactions:', error);
    }
  }, []);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        setIsLoadingPrice(true);
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setEthPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        // Fallback price if API fails
        setEthPrice(3000);
      } finally {
        setIsLoadingPrice(false);
      }
    };
    
    fetchEthPrice();
  }, []);

  // Calculate USD equivalent
  const calculateUsdAmount = useCallback(() => {
    const amount = parseFloat(selectedAmount || "0");
    if (isNaN(amount) || ethPrice === 0) return "0.00";
    return (amount * ethPrice).toFixed(2);
  }, [selectedAmount, ethPrice]);

  // Convert USD to ETH
  const convertUsdToEth = (usdAmount: number) => {
    if (ethPrice === 0) return "0";
    return (usdAmount / ethPrice).toFixed(6);
  };

  const formatBalance = (balance?: bigint) => {
    if (!balance) return "0";
    return parseFloat(formatEther(balance)).toFixed(6);
  };

  // Check if selected amount exceeds balance
  const isInsufficientBalance = () => {
    if (!ethBalance || activeTab === "sell") return false;
    try {
      const amountInWei = parseEther(selectedAmount || "0");
      return amountInWei > ethBalance;
    } catch {
      return false;
    }
  };

  const quickAmounts = ["0.0001 ETH", "0.001 ETH", "0.01 ETH", "0.1 ETH"];

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    const regex = /^\d*\.?\d*$/;
    if (regex.test(value) || value === "") {
      setSelectedAmount(value);
    }
  };

  const recordTransaction = useCallback(async (txHash: string) => {
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
    saveProcessedTxs();

    try {
      const usdAmount = calculateUsdAmount();
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHash,
          coinAddress,
          coinName,
          coinSymbol,
          fid: fid?.toString(),
          username,
          address,
          ethAmount: selectedAmount,
          usdAmount,
          action: activeTab
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to record transaction');
      } else {
        console.log(`Transaction recorded successfully: ${txHash} for ${coinSymbol}`);
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
    }
  }, [address, fid, saveProcessedTxs, calculateUsdAmount, coinAddress, coinName, coinSymbol, username, selectedAmount, activeTab]);

  // Handle transaction success - using useCallback for better reliability
  const handleTransactionSuccess = useCallback(async (response: TransactionResponse) => {
    console.log("🎉 Transaction success callback triggered in", context?.client || "unknown client");
    
    setTransactionStep("Success callback received!");
    
    // Debug: Log the full response structure
    console.log("Full response object:", JSON.stringify(response, null, 2));
    
    try {
      // More robust transaction hash extraction
      let txHash: string | undefined;
      
      // Try multiple ways to extract transaction hash
      if (response.transactionReceipts && response.transactionReceipts.length > 0) {
        txHash = response.transactionReceipts[0].transactionHash;
        console.log("✅ Transaction hash from receipts[0]:", txHash);
        setTransactionStep(`Hash found: ${txHash?.slice(0, 10)}...`);
      } else if (response.transactionReceipts && response.transactionReceipts[0]) {
        txHash = response.transactionReceipts[0].transactionHash;
        console.log("✅ Transaction hash from single receipt:", txHash);
        setTransactionStep(`Hash found (alt): ${txHash?.slice(0, 10)}...`);
      } else {
        console.error("❌ No transaction receipts found in response");
        console.log("Response keys:", Object.keys(response));
        setTransactionStep(`No receipts found. Keys: ${Object.keys(response).join(", ")}`);
        
        // Try to extract from alternative paths
        if ((response as any).transactionHash) {
          txHash = (response as any).transactionHash;
          console.log("✅ Transaction hash from alternative path:", txHash);
          setTransactionStep(`Hash from alt path: ${txHash?.slice(0, 10)}...`);
        }
      }
      
      if (!txHash) {
        console.error("❌ No transaction hash found in response");
        setTransactionStep("❌ No transaction hash found");
        return;
      }
      
      // Set success state
      console.log("🚀 Setting success state with hash:", txHash);
      setTransactionStep("✅ Setting success state...");
      setSuccessTxHash(txHash);
      setSuccessAmount(selectedAmount);
      setShowSuccess(true);
      setTransactionStartTime(null);
      
      // Record transaction
      await recordTransaction(txHash);
      
    } catch (error) {
      console.error('❌ Error handling transaction success:', error);
      setTransactionStep(`❌ Error in success handler: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [selectedAmount, recordTransaction, context]);

  // Handle transaction error
  const handleTransactionError = useCallback((error: TransactionError) => {
    console.error("❌ Transaction failed:", error);
    setTransactionError(error.message || "Transaction failed");
    setTransactionStep(`❌ Transaction failed: ${error.message || "Unknown error"}`);
    setTransactionStartTime(null);
  }, []);

  // Debug: Monitor transaction timeout
  useEffect(() => {
    if (transactionStartTime && !showSuccess) {
      const timeout = setTimeout(() => {
        const elapsed = Date.now() - transactionStartTime;
        console.log(`⏰ Transaction has been pending for ${elapsed}ms without success callback`);
        console.log("Current transaction state:", {
          showSuccess,
          successTxHash,
          transactionError,
          transactionCallsLength: transactionCalls.length
        });
        
        // Set visual timeout warning
        setTransactionStep(`⏰ Pending ${Math.round(elapsed/1000)}s - No success callback yet. CB Wallet may have different callback behavior.`);
      }, 10000); // Check after 10 seconds

      return () => clearTimeout(timeout);
    }
  }, [transactionStartTime, showSuccess, successTxHash, transactionError, transactionCalls.length]);

  const handleClose = () => {
    setShowSuccess(false);
    setSuccessTxHash("");
    setSuccessAmount("");
    onClose();
  };

  const insufficientBalance = isInsufficientBalance();
  const hasInsufficientBalance = insufficientBalance;
  const isDisabled = !address || hasInsufficientBalance || !coinAddress || parseFloat(selectedAmount || "0") <= 0 || preparingTransaction || transactionCalls.length === 0;

  // Success view
  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md bg-black text-white border-gray-800 p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Transaction Successful</DialogTitle>
            <DialogDescription>
              Your {coinName} purchase was successful
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 pt-8 space-y-6 text-center">
            {/* Success Icon */}
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            
            {/* Success Message */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Transaction Successful!</h2>
              <p className="text-gray-400">
                You successfully purchased {successAmount} ETH worth of {coinName} ({coinSymbol})
              </p>
            </div>

            {/* Transaction Details */}
            <Card className="bg-gray-900 border-gray-700 p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-semibold">{successAmount} ETH</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Token</span>
                  <span className="text-white font-semibold">{coinName} ({coinSymbol})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">USD Value</span>
                  <span className="text-white font-semibold">
                    ${(parseFloat(successAmount || "0") * ethPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Transaction Hash */}
            {successTxHash && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Transaction Hash</p>
                <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg p-3">
                  <span className="text-xs font-mono text-gray-300 truncate">
                    {successTxHash.slice(0, 10)}...{successTxHash.slice(-8)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openUrl(`https://basescan.org/tx/${successTxHash}`)}
                    className="text-blue-400 hover:text-blue-300 p-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => openUrl(`https://basescan.org/tx/${successTxHash}`)}
                variant="outline"
                className="w-full bg-transparent border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
              >
                View on Block Explorer
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              
              <Button
                onClick={handleClose}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-black text-white border-gray-800 p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Collect {coinName}</DialogTitle>
          <DialogDescription>
            Buy or sell {coinName} tokens using ETH
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 pt-8 space-y-6">
          {/* Header with Balance */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex space-x-4">
              <Button
                variant={activeTab === "buy" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("buy")}
                className={`${
                  activeTab === "buy" 
                    ? "bg-green-500 hover:bg-green-600 text-black" 
                    : "text-gray-400 hover:text-white"
                } rounded-full px-6`}
              >
                Buy
              </Button>
              <Button
                variant={activeTab === "sell" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("sell")}
                disabled={true}
                className={`${
                  activeTab === "sell" 
                    ? "bg-white text-black hover:bg-gray-200" 
                    : "text-gray-400 hover:text-white"
                } rounded-full px-6 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sell
              </Button>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Balance</div>
              <div className="text-lg font-semibold">
                {formatBalance(ethBalance)} ETH
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <Card className={`bg-gray-900 border-2 p-4 ${
            insufficientBalance ? "border-red-500" : "border-gray-700"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Input
                  value={selectedAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.0"
                  className={`text-3xl font-mono bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 ${
                    insufficientBalance ? "text-red-400" : "text-white"
                  }`}
                />
                <div className="text-sm text-gray-400 mt-1">
                  {isLoadingPrice ? (
                    "Loading price..."
                  ) : (
                    `≈ $${calculateUsdAmount()} `
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 bg-gray-800 rounded-full px-3 py-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center">
                    <Image 
                      src="https://raw.githubusercontent.com/maticnetwork/polygon-token-assets/main/assets/tokenAssets/eth.svg" 
                      alt="ETH"
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  </div>
                  <span className="text-white font-medium">ETH</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAmount(amount.replace(" ETH", ""));
                }}
                className="bg-blue-800 border-blue-700 text-white hover:bg-blue-700 hover:border-blue-600"
              >
                {amount}
              </Button>
            ))}
          </div>

          {/* Dollar Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {["$0.1", "$1", "$10", "$100"].map((dollarAmount) => (
              <Button
                key={dollarAmount}
                variant="outline"
                size="sm"
                onClick={() => {
                  const usdValue = parseFloat(dollarAmount.replace("$", ""));
                  setSelectedAmount(convertUsdToEth(usdValue));
                }}
                disabled={isLoadingPrice}
                className="bg-blue-800 border-blue-700 text-white hover:bg-blue-700 hover:border-blue-600 disabled:opacity-50"
              >
                {dollarAmount}
              </Button>
            ))}
          </div>

          {/* Debug Information Panel */}
          {(debugInfo || transactionStep) && (
            <div className="bg-blue-900 border border-blue-500 rounded-lg p-3 text-xs">
              <p className="text-blue-200 font-semibold mb-1">Debug Info (for CB Wallet testing):</p>
              {debugInfo && (
                <p className="text-blue-200 mb-1 break-all">
                  <span className="font-semibold">Context:</span> {debugInfo}
                </p>
              )}
              {transactionStep && (
                <p className="text-blue-200 break-words">
                  <span className="font-semibold">Step:</span> {transactionStep}
                </p>
              )}
            </div>
          )}

          {/* Error Message Display */}
          {transactionError && (
            <div className="bg-red-900 border border-red-500 rounded-lg p-3">
              <p className="text-red-200 text-sm">
                <span className="font-semibold">Error:</span> {transactionError}
              </p>
              {transactionCalls.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Trigger re-preparation by changing a dependency
                    setTransactionError("");
                    setPreparingTransaction(true);
                  }}
                  className="mt-2 text-xs bg-red-800 border-red-600 text-red-100 hover:bg-red-700"
                >
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* Action Button - Use Transaction Component for Buy */}
          {activeTab === "buy" && coinAddress ? (
            <Transaction
              calls={transactionCalls}
              onSuccess={handleTransactionSuccess}
              onError={handleTransactionError}
              onStatus={(status) => {
                // Update visual step based on transaction status
                if (status.statusName === "init") {
                  setTransactionStep("🔄 Transaction initiated...");
                } else if (status.statusName === "buildingTransaction") {
                  setTransactionStep("🔧 Building transaction...");
                } else if (status.statusName === "transactionPending") {
                  setTransactionStep("⏳ Transaction pending on blockchain...");
                } else if (status.statusName === "transactionLegacyExecuted") {
                  setTransactionStep("⚡ Transaction executed (legacy)...");
                } else if (status.statusName === "success") {
                  setTransactionStep("✅ Transaction successful!");
                } else if (status.statusName === "error") {
                  setTransactionStep("❌ Transaction error occurred");
                } else {
                  setTransactionStep(`📊 Status: ${status.statusName}`);
                }
              }}
            >
              {/* <div className="flex flex-col w-full"> */}
                <TransactionButton 
                  text={preparingTransaction ? "Preparing..." : loading ? `Buying...` : `Buy ${coinName} (${coinSymbol})`}
                  disabled={isDisabled}
                  className="w-full font-semibold py-3 text-lg bg-green-500 hover:bg-green-600 text-black disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                {/* Visual Transaction Step Indicator */}
                {transactionStep && !showSuccess && (
                  <div className="mt-2 text-center">
                    <p className="text-xs text-gray-400">
                      {transactionStep}
                    </p>
                  </div>
                )}
              <TransactionStatus>
                <TransactionStatusAction />
                <TransactionStatusLabel />
              </TransactionStatus>
              <TransactionToast className="mb-4">
                <TransactionToastIcon />
                <TransactionToastLabel />
                <TransactionToastAction />
              </TransactionToast>
              {/* </div> */}
            </Transaction>
          ) : (
            <Button 
              disabled={insufficientBalance || !coinAddress}
              className={`w-full font-semibold py-3 text-lg ${
                insufficientBalance || !coinAddress
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed" 
                  : "bg-green-500 hover:bg-green-600 text-black"
              }`}
              onClick={() => {
                // TODO: Implement sell logic
                console.log(`${activeTab}ing ${selectedAmount} ETH worth of ${coinSymbol}`);
                handleClose();
              }}
            >
              {activeTab === "buy" ? "Connect Wallet to Buy" : "Sell"} {coinName} ({coinSymbol})
            </Button>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}