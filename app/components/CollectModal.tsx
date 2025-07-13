"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { TransactionButton } from '@coinbase/onchainkit/transaction';
import { useAccount } from 'wagmi';
import { useMiniKit, useOpenUrl } from '@coinbase/onchainkit/minikit';
import { base } from 'viem/chains';
import { CoinSession } from "@/lib/types";
import { useTransactionContext } from './AppWrapper';

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
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  const { address } = useAccount();
  const { context } = useMiniKit();
  const openUrl = useOpenUrl();
  const { transactionState, clearTransactionState } = useTransactionContext();
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
    const clientFid = context?.client?.clientFid;
    const clientAdded = context?.client?.added;
    setDebugInfo(`ClientFID: ${clientFid || "unknown"} | Added: ${clientAdded || false} | Address: ${address || "none"} | FID: ${fid || "none"}`);
  }, [context, address, fid, username]);
  
  const coinName = session?.metadata?.name || "Coin";
  const coinSymbol = session?.metadata?.symbol || "COIN";
  const coinAddress = session?.metadata?.coinAddress;

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false);
      setSuccessTxHash("");
      setSuccessAmount("");
      setSelectedAmount("0.000111");
      setActiveTab("buy");
      setDebugInfo("");
      clearTransactionState();
    }
  }, [isOpen, clearTransactionState]);

  // Monitor transaction state changes for success
  useEffect(() => {
    if (transactionState.txHash && !showSuccess) {
      setShowSuccess(true);
      setSuccessTxHash(transactionState.txHash);
      setSuccessAmount(selectedAmount);
    }
  }, [transactionState.txHash, showSuccess, selectedAmount]);

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

  const handleClose = () => {
    setShowSuccess(false);
    setSuccessTxHash("");
    setSuccessAmount("");
    clearTransactionState();
    onClose();
  };

  const insufficientBalance = isInsufficientBalance();
  const hasInsufficientBalance = insufficientBalance;
  const isDisabled = !address;

  // Success view
  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md bg-black text-white border-gray-800 p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Transaction Successful</DialogTitle>
            <DialogDescription>
              Your test transaction was successful
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
                Your test transaction was completed successfully
              </p>
            </div>

            {/* Transaction Details */}
            <Card className="bg-gray-900 border-gray-700 p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-semibold">0 ETH</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Type</span>
                  <span className="text-white font-semibold">Test Transaction</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status</span>
                  <span className="text-green-400 font-semibold">Success</span>
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
          <DialogTitle>Test Transaction</DialogTitle>
          <DialogDescription>
            Test the transaction functionality
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
                Test
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
                Disabled
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

          {/* Debug Information Panel - Always visible for testing */}
          <div className="bg-blue-900 border border-blue-500 rounded-lg p-3 text-xs">
            <p className="text-blue-200 font-semibold mb-2">🔍 Debug Info (CB Wallet):</p>
            
            {/* Client Info */}
            <div className="mb-2 space-y-1">
              <p className="text-blue-200">
                <span className="font-semibold">ClientFID:</span> {context?.client?.clientFid || "unknown"}
              </p>
              <p className="text-blue-200">
                <span className="font-semibold">Added:</span> {context?.client?.added ? "true" : "false"}
              </p>
              <p className="text-blue-200 break-all">
                <span className="font-semibold">Address:</span> {address || "none"}
              </p>
              <p className="text-blue-200">
                <span className="font-semibold">UserFID:</span> {fid || "none"}
              </p>
              <p className="text-blue-200">
                <span className="font-semibold">Chain:</span> {networkChainId} {networkChainId === base.id ? "(Base ✅)" : `(Expected: ${base.id} ❌)`}
              </p>
            </div>

            {/* Current Step */}
            {transactionState.step && (
              <p className="text-blue-200 break-words mb-2">
                <span className="font-semibold">Current Step:</span> {transactionState.step}
              </p>
            )}
            
            {/* Quick status indicators */}
            <div className="flex flex-wrap gap-1">
              <span className={`px-1 py-0.5 rounded text-xs ${address ? 'bg-green-600' : 'bg-red-600'}`}>
                Wallet: {address ? 'Connected' : 'None'}
              </span>
              <span className={`px-1 py-0.5 rounded text-xs ${networkChainId === base.id ? 'bg-green-600' : 'bg-red-600'}`}>
                Chain: {networkChainId} {networkChainId === base.id ? '(Base)' : '(Wrong)'}
              </span>
              <span className={`px-1 py-0.5 rounded text-xs bg-green-600`}>
                Mode: Test Transaction
              </span>
            </div>
          </div>

          {/* Error Message Display */}
          {transactionState.error && (
            <div className="bg-red-900 border border-red-500 rounded-lg p-3">
              <p className="text-red-200 text-sm">
                <span className="font-semibold">Error:</span> {transactionState.error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Clear the error to allow retry
                  clearTransactionState();
                }}
                className="mt-2 text-xs bg-red-800 border-red-600 text-red-100 hover:bg-red-700"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Action Button - Use TransactionButton with stable Transaction */}
          {activeTab === "buy" && address ? (
            <TransactionButton 
              text={loading ? `Testing...` : `Test Transaction (0 ETH to Self)`}
              disabled={isDisabled}
              className="w-full font-semibold py-3 text-lg bg-green-500 hover:bg-green-600 text-black disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            />
          ) : (
            <Button 
              disabled={!address}
              className={`w-full font-semibold py-3 text-lg ${
                !address
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed" 
                  : "bg-green-500 hover:bg-green-600 text-black"
              }`}
              onClick={() => {
                console.log(`Test transaction for ${activeTab} mode`);
                handleClose();
              }}
            >
              {activeTab === "buy" ? "Connect Wallet to Test" : "Test Transaction"}
            </Button>
          )}

          {/* Visual Transaction Step Indicator */}
          {transactionState.step && !showSuccess && (
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-400">
                {transactionState.step}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}