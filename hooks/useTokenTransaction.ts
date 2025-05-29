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
    if (!address || !coinAddress) return null;
    
    // If not on base mainnet, don't fetch a real quote
    if (networkChainId !== base.id) {
      console.log('Not on base mainnet, skipping real quote fetch');
      return { transaction: { to: '', data: '0x' as `0x${string}`, value: '0' } };
    }
    
    try {
      // Convert ETH amount to wei
      const sellAmount = parseEther(ethAmount || "0").toString();
      
      // These parameters will get the actual quote for execution
      const params = new URLSearchParams({
        chainId: base.id.toString(),
        sellToken: NATIVE_ETH_ADDRESS,
        buyToken: coinAddress,
        sellAmount: sellAmount,
        taker: address as string,
      });
      
      const response = await fetch(`/api/quote?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Token quote data:', data);
        return data;
      }
    } catch (error) {
      console.error('Error fetching token quote:', error);
    }
    
    return null;
  }, [address, coinAddress, ethAmount]);

  const handleTokenTransaction = useCallback(async (networkChainId: number) => {
    try {
      const quote = await fetchTokenQuote(networkChainId);
      
      if (!quote || !quote.transaction) {
        throw new Error('Failed to get quote');
      }

      // Return the transaction data
      return [{
        to: quote.transaction.to as `0x${string}`,
        data: quote.transaction.data as `0x${string}`,
        value: BigInt(quote.transaction.value || 0)
      }];
    } catch (error) {
      console.error(`Error in token transaction:`, error);
      throw error; // Rethrow to signal to Transaction component
    }
  }, [fetchTokenQuote]);

  return {
    handleTokenTransaction,
    fetchTokenQuote,
  };
} 