import { Address, erc20Abi, PublicClient, WalletClient, encodeFunctionData, Hex } from 'viem';
import { 
  createCoinCall, 
  DeployCurrency, 
  getCoinCreateFromLogs,
  validateMetadataURIContent,
  ValidMetadataURI
} from '@zoralabs/coins-sdk';
import { 
  CoinPlatform, 
  CoinCreationParams, 
  CoinCreationResult, 
  PlatformType 
} from '../coin-platform-types';
import { Participant } from '../types';
import { base } from 'viem/chains';

export class ZoraPlatform implements CoinPlatform {
  async createCoin(
    params: CoinCreationParams,
    walletClient: WalletClient,
    publicClient: PublicClient
  ): Promise<CoinCreationResult> {
    const { metadata, creatorFid, participants, creatorAddress } = params;

    // Find creator address from participants
    const creatorParticipant = participants?.[creatorFid];
    const payoutAddress = creatorParticipant?.address || creatorAddress;
    
    console.log(`Setting payout to creator: ${creatorFid}, address: ${payoutAddress}`);
    
    // Validate the metadata URI before using it
    await validateMetadataURIContent(metadata.zoraTokenUri as ValidMetadataURI);

    // Define coin parameters
    const coinParams = {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.zoraTokenUri as ValidMetadataURI,
      payoutRecipient: creatorAddress,
      platformReferrer: creatorAddress,
      currency: DeployCurrency.ETH,
      chainId: base.id,
    };

    // Create the coin with simplified gas handling
    console.log("Creating coin with sendTransaction...");
    
    if (!walletClient.account) {
      throw new Error("Wallet client account not found");
    }
    
    const fallbackGasLimit = BigInt(8000000); // Fallback 8M gas if first attempt fails
    let coinCreationResult;
    
    try {
      console.log("First attempt: sending transaction without gas estimation...");
      
      // Get the contract call parameters
      const createCoinRequest = await createCoinCall(coinParams);
      const { abi, functionName, address, args: callArgs, value } = createCoinRequest;
      const data = encodeFunctionData({ abi, functionName, args: callArgs });
      const txRequest = { to: address as Hex, data, value };

      // Send transaction
      const hash = await walletClient.sendTransaction(txRequest as any);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const deployment = getCoinCreateFromLogs(receipt);
      
      // Create result object matching SDK format
      coinCreationResult = {
        hash,
        receipt,
        address: deployment?.coin,
        deployment,
      };
      
      // Log transaction details for debugging
      console.log(`Transaction completed with hash: ${coinCreationResult.hash}`);
      console.log(`Gas used: ${coinCreationResult.receipt.gasUsed?.toString() || 'unknown'}`);
      console.log(`Transaction status: ${coinCreationResult.receipt.status}`);
      
    } catch (error: any) {
      console.error("First attempt failed:", error);
      console.log("Retrying with fallback gas limit...");
      
      try {
        // Retry with fallback gas limit
        const createCoinRequest = await createCoinCall(coinParams);
        const { abi, functionName, address, args: callArgs, value } = createCoinRequest;
        const data = encodeFunctionData({ abi, functionName, args: callArgs });
        const txRequest = { to: address as Hex, data, value, gas: fallbackGasLimit };

        // Send transaction with gas parameter
        const hash = await walletClient.sendTransaction(txRequest as any);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const deployment = getCoinCreateFromLogs(receipt);
        
        // Create result object matching SDK format
        coinCreationResult = {
          hash,
          receipt,
          address: deployment?.coin,
          deployment,
        };
        
        // Log transaction details for debugging
        console.log(`Retry transaction completed with hash: ${coinCreationResult.hash}`);
        console.log(`Gas used: ${coinCreationResult.receipt.gasUsed?.toString() || 'unknown'}`);
        console.log(`Gas limit was: ${fallbackGasLimit.toString()}`);
        console.log(`Transaction status: ${coinCreationResult.receipt.status}`);
        
      } catch (retryError: any) {
        console.error("Retry attempt also failed:", retryError);
        throw retryError;
      }
    }
    
    if (!coinCreationResult) {
      throw new Error("Failed to create coin");
    }

    const status = coinCreationResult.receipt.status;
    const coinAddress = coinCreationResult.address;
    const txHash = coinCreationResult.hash;
    const deployment = coinCreationResult.deployment;

    // Check if the transaction was successful
    if (status !== "success") {
      console.error(`Coin creation failed with status: ${status}. Hash: ${txHash}`);
      throw new Error(`Transaction failed with status: ${status}`);
    }

    return {
      coinAddress: coinAddress as Address,
      txHash,
      deployment,
      status,
      platform: 'zora'
    };
  }

  async distributeTokens(
    coinAddress: Address,
    participants: { [fid: string]: Participant },
    walletClient: WalletClient,
    publicClient: PublicClient
  ): Promise<void> {
    try {
      console.log("Distributing tokens to participants...");
      const participantList = Object.values(participants);
      const participantAddresses = participantList
        .filter((p: Participant) => p.address)
        .map((p: Participant) => p.address as Address);
      
      if (participantAddresses.length === 0) {
        console.log("No valid participant addresses found for token distribution");
        return;
      }
      
      // Get deployer account address
      if (!walletClient.account?.address) {
        throw new Error("Deployer address not found");
      }
      const deployerAddress = walletClient.account.address;

      // Check account balance
      const balance = await publicClient.readContract({
        address: coinAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [deployerAddress]
      });
      
      console.log(`Account balance: ${balance} tokens`);
      
      // Reserve 10% for the deployer account
      const reserveAmount = balance / BigInt(10); // 10% of the total
      const distributionAmount = balance - reserveAmount;
      
      console.log(`Reserving ${reserveAmount} tokens (10%) for the deployer account`);
      console.log(`Distributing ${distributionAmount} tokens (90%) to participants`);
      
      // Calculate amount per participant
      const amountPerParticipant = distributionAmount / BigInt(participantAddresses.length);
      console.log(`Distributing ${amountPerParticipant} tokens to each of ${participantAddresses.length} participants`);
      
      // Transfer tokens to each participant
      for (let i = 0; i < participantAddresses.length; i++) {
        const participantAddress = participantAddresses[i];
        console.log(`Transferring tokens to ${participantAddress}...`);
        
        try {
          // Send transaction with incremental gas price for each subsequent transfer
          const hash = await (walletClient as any).writeContract({
            address: coinAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [participantAddress, amountPerParticipant],
            // Add a small gas price increase for each subsequent transaction
            gas: BigInt(100000 + (i * 5000))
          });
          
          console.log(`Token transfer submitted. Transaction hash: ${hash}`);
          
          // Wait for transaction to be mined before proceeding to next transfer
          console.log('Waiting for transaction confirmation...');
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log(`Transaction confirmed with status: ${receipt.status}`);
        } catch (error) {
          console.error(`Error transferring tokens to ${participantAddress}:`, error);
          // Continue with next participant even if current transfer fails
        }
      }
      
      console.log("Token distribution completed successfully");
    } catch (error) {
      console.error("Error distributing tokens to participants:", error);
      // Continue with the process even if token distribution fails
      throw error;
    }
  }

  getPlatformType(): PlatformType {
    return 'zora';
  }
} 