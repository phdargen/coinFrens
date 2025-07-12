import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { base } from 'viem/chains';
import { NATIVE_ETH_ADDRESS } from '@/src/constants';

interface UseTokenTransactionProps {
  coinAddress?: string;
  ethAmount: string;
}

export function useTokenTransaction({ coinAddress, ethAmount }: UseTokenTransactionProps) {
  const { address } = useAccount();

  const fetchTokenQuote = useCallback(async (networkChainId: number) => {
    console.log('🔍 fetchTokenQuote called with:', { address, coinAddress, ethAmount, networkChainId });
    
    if (!address || !coinAddress) {
      console.error('❌ Missing address or coinAddress:', { address, coinAddress });
      return null;
    }
    
    // If not on base mainnet, don't fetch a real quote
    if (networkChainId !== base.id) {
      console.error('❌ Not on base mainnet, network not supported');
      throw new Error(`Network not supported. Please switch to Base mainnet (chainId: ${base.id}). Current chainId: ${networkChainId}`);
    }
    
    try {
      // Convert ETH amount to wei
      console.log('💰 Converting ETH amount to wei:', ethAmount);
      const sellAmount = parseEther(ethAmount || "0").toString();
      console.log('💰 Sell amount in wei:', sellAmount);
      
      // These parameters will get the actual quote for execution
      const params = new URLSearchParams({
        chainId: base.id.toString(),
        sellToken: NATIVE_ETH_ADDRESS,
        buyToken: coinAddress,
        sellAmount: sellAmount,
        taker: address as string,
      });
      
      const quoteUrl = `/api/quote?${params.toString()}`;
      console.log('📡 Fetching quote from:', quoteUrl);
      
      const response = await fetch(quoteUrl);
      console.log('📡 Quote response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token quote data received:', data);
        
        // Additional validation for the quote response
        if (data.error) {
          console.error('❌ Quote API returned error:', data.error);
          return null;
        }
        
        // Validate transaction structure
        if (!data.transaction) {
          console.error('❌ No transaction object in quote response');
          return null;
        }
        
        if (!data.transaction.to || !data.transaction.data) {
          console.error('❌ Invalid transaction structure:', data.transaction);
          return null;
        }
        
        console.log('✅ Quote validation passed');
        return data;
      } else {
        console.error('❌ Quote API request failed:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('❌ Quote API error response:', errorData);
        throw new Error(`Quote API failed: ${response.status} ${response.statusText} - ${errorData}`);
      }
    } catch (error) {
      console.error('❌ Error fetching token quote:', error);
      throw error;
    }
  }, [address, coinAddress, ethAmount]);

  const handleTokenTransaction = useCallback(async (networkChainId: number) => {
    console.log('🚀 handleTokenTransaction called with networkChainId:', networkChainId);
    
    try {
      console.log('📡 About to fetch token quote...');
      const quote = await fetchTokenQuote(networkChainId);
      console.log('📡 Quote received:', quote);
      
      if (!quote) {
        console.error('❌ Quote is null or undefined');
        throw new Error('Failed to get quote - API returned null response');
      }
      
      if (!quote.transaction) {
        console.error('❌ Quote has no transaction object:', quote);
        throw new Error('Failed to get quote - API returned invalid response (no transaction)');
      }

      // Validate transaction data
      if (!quote.transaction.to || !quote.transaction.data) {
        console.error('❌ Invalid transaction data:', quote.transaction);
        throw new Error('Invalid transaction data in quote response');
      }

      console.log('✅ Quote validation passed, creating transaction calls...');
      
      // Return the transaction data with proper validation
      const transactionCalls = [{
        to: quote.transaction.to as `0x${string}`,
        data: quote.transaction.data as `0x${string}`,
        value: BigInt(quote.transaction.value || 0)
      }];
      
      console.log('✅ Transaction calls created:', transactionCalls);
      return transactionCalls;
    } catch (error) {
      console.error(`❌ Error in token transaction:`, error);
      
      // Provide more specific error information
      if (error instanceof Error) {
        const enhancedError = new Error(`Token transaction failed: ${error.message}`);
        console.error('❌ Throwing enhanced error:', enhancedError.message);
        throw enhancedError;
      }
      
      const unknownError = new Error('Token transaction failed: Unknown error');
      console.error('❌ Throwing unknown error:', unknownError.message);
      throw unknownError;
    }
  }, [fetchTokenQuote]);

  return {
    handleTokenTransaction,
    fetchTokenQuote,
  };
} 