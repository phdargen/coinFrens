import { Address, PublicClient, WalletClient } from 'viem';
import { createCoin, createCoinCall, getCoinCreateFromLogs } from '@zoralabs/coins-sdk';
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

    // Create the coin with retry logic and manual gas handling
    console.log("Creating coin with smart gas handling...");
    
    const maxRetries = 3;
    const retryDelay = 10000; // 10 seconds between retries
    let lastError: any = null;
    let coinCreationResult;
    let gasMultiplier = BigInt(150); // 150% of estimated gas
    let fallbackGasLimit = BigInt(8000000); // Fallback 8M gas if estimation fails
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let request;
      try {
        console.log(`Attempting to create coin (attempt ${attempt}/${maxRetries})...`);
        
        if (attempt > 1) {
          console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        // Get the contract call parameters
        const createCoinRequest = await createCoinCall(coinParams);
        
        // Simulate the contract call to get the request
        const simulateResult = await publicClient.simulateContract({
          ...createCoinRequest,
          account: walletClient.account,
        });
        request = simulateResult.request;
        console.log("Request:", request);
        
        // Use estimated gas with multiplier if available, otherwise use fallback
        if (request.gas) {
          const estimatedGas = request.gas;
          request.gas = (estimatedGas * gasMultiplier) / BigInt(100);
          console.log(`Using ${gasMultiplier}% of estimated gas: ${estimatedGas} -> ${request.gas}`);
        } else {
          console.log(`No gas estimate available, using fallback gas limit: ${fallbackGasLimit}`);
          request.gas = fallbackGasLimit;
        }
        console.log("Request with gas limit:", request);
        
        console.log(`Executing transaction with gas limit: ${request.gas.toString()}`);
        
        // Execute the transaction
        const hash = await walletClient.writeContract(request);
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
        console.log(`Gas limit was: ${request.gas.toString()}`);
        console.log(`Gas utilization: ${coinCreationResult.receipt.gasUsed ? 
          ((Number(coinCreationResult.receipt.gasUsed) / Number(request.gas)) * 100).toFixed(1) + '%' : 'unknown'}`);
        console.log(`Transaction status: ${coinCreationResult.receipt.status}`);
        
        // Check if transaction was successful
        if (coinCreationResult.receipt.status === "success") {
          console.log("Coin created successfully:", coinCreationResult);
          break; // Success, exit the loop
        } else {
          // Transaction reverted - increase multiplier/limit for next attempt
          const revertError = new Error(`Transaction reverted: ${coinCreationResult.hash}`);
          console.error(`Transaction reverted on attempt ${attempt}. Hash: ${coinCreationResult.hash}`);
          
          // Increase multiplier/limit for next attempt
          if (request?.gas === fallbackGasLimit) {
            // If using fallback, increase by 2M
            fallbackGasLimit += BigInt(2000000);
            console.log(`Increasing fallback gas limit to ${fallbackGasLimit.toString()} for next attempt`);
          } else {
            // If using multiplier, increase by 50%
            gasMultiplier += BigInt(50);
            console.log(`Increasing gas multiplier to ${gasMultiplier}% for next attempt`);
          }
          
          throw revertError;
        }
      } catch (error: any) {
        console.error(`Error on attempt ${attempt}:`, error);
        lastError = error;
        
        // Check if error is related to gas or execution
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isGasRelated = errorMessage.includes("gas") || 
                           errorMessage.includes("out of gas") || 
                           errorMessage.includes("execution reverted") ||
                           errorMessage.includes("Transaction reverted");
        
        if (isGasRelated) {
          console.log(`Gas-related error detected: ${errorMessage}`);
          if (request?.gas === fallbackGasLimit) {
            // If using fallback, increase more aggressively
            fallbackGasLimit += BigInt(3000000);
            console.log(`Increasing fallback gas limit to ${fallbackGasLimit.toString()} for gas-related retry`);
          } else {
            // If using multiplier, increase more aggressively
            gasMultiplier += BigInt(100);
            console.log(`Increasing gas multiplier to ${gasMultiplier}% for gas-related retry`);
          }
        } else if (!errorMessage.includes("Metadata fetch failed")) {
          // If it's not a metadata fetch issue or gas issue, don't retry
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