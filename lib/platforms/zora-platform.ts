import { Address, PublicClient, WalletClient } from 'viem';
import { createCoin } from '@zoralabs/coins-sdk';
import { 
  CoinPlatform, 
  CoinCreationParams, 
  CoinCreationResult, 
  PlatformType 
} from '../coin-platform-types';
import { Participant } from '../types';

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
    
    // Define coin parameters
    const coinParams = {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.zoraTokenUri,
      payoutRecipient: creatorAddress,
      platformReferrer: creatorAddress,
      description: metadata.description,
      initialPurchaseWei: BigInt(0) // No initial purchase
    };

    // Create the coin with retry logic
    console.log("Creating coin with Zora SDK...");
    
    const maxRetries = 3;
    const retryDelay = 10000; // 10 seconds between retries
    let lastError: any = null;
    let coinCreationResult;
    let gasMultiplier = 150; // Start with 150%
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting to create coin (attempt ${attempt}/${maxRetries}) with gas multiplier: ${gasMultiplier}%...`);
        
        if (attempt > 1) {
          console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        // Create the coin
        coinCreationResult = await createCoin(coinParams, walletClient, publicClient, { gasMultiplier });
        
        // Check if transaction was successful
        if (coinCreationResult.receipt.status === "success") {
          console.log("Coin created successfully:", coinCreationResult);
          break; // Success, exit the loop
        } else {
          // Transaction reverted - increase gas multiplier for next attempt
          const revertError = new Error(`Transaction reverted: ${coinCreationResult.hash}`);
          console.error(`Transaction reverted on attempt ${attempt}. Hash: ${coinCreationResult.hash}`);
          
          // Increase gas multiplier for next attempt (add 50% more)
          gasMultiplier += 50;
          console.log(`Increasing gas multiplier to ${gasMultiplier}% for next attempt`);
          
          throw revertError;
        }
      } catch (error: any) {
        console.error(`Error on attempt ${attempt}:`, error);
        lastError = error;
        
        // Check if error is related to metadata fetch
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("Metadata fetch failed") && !errorMessage.includes("Transaction reverted")) {
          // If it's not a metadata fetch issue or revert, don't retry
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    if (!coinCreationResult) {
      console.error("Coin creation failed after all retries");
      throw lastError || new Error("Failed to create coin after multiple retries");
    }

    const status = coinCreationResult.receipt.status;
    const coinAddress = coinCreationResult.address;
    const txHash = coinCreationResult.hash;
    const deployment = coinCreationResult.deployment;

    // Check if the final transaction was successful
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

      // Define ERC20 ABI for token transfers
      const erc20Abi = [
        {
          "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
          ],
          "name": "transfer",
          "outputs": [{"name": "", "type": "bool"}],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"name": "account", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        }
      ] as const;
      
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