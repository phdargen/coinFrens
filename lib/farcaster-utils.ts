// Utility functions to safely extract values from any Farcaster context structure
import { useAccount } from 'wagmi';

export function getFarcasterUserId(context: any): string {
  if (!context) {
    // When no Farcaster context exists, try to get the wallet address
    try {
      // Get the connected wallet address
      const address = context?.walletClient?.account?.address || 
                     context?.connectedAddress || 
                     '';
      
      if (address) {
        // Prefix the address with 'wallet-' to distinguish from Farcaster IDs
        return `wallet-${address}`;
      }
    } catch (error) {
      console.error("Error getting wallet address:", error);
    }
    
    return "";
  }
  
  // First try to get the fid from user.fid, as specified
  const fid = context?.user?.fid;
  
  // Debug the context structure and extracted fid
  console.log("Farcaster context:", JSON.stringify(context, null, 2));
  console.log("Extracted fid:", fid);
  
  // If fid exists, return it as a string
  if (fid) return String(fid);
  
  // In development mode, use a fallback hardcoded ID
  if (process.env.NODE_ENV === 'development') {
    console.log("Using development fallback FID");
    return "372088";
  }
  
  // Otherwise, try connected address or other possible paths for the user ID
  // Get the wallet address if available
  const address = context.connectedAddress || 
                 context.walletClient?.account?.address || 
                 '';
  
  if (address) {
    // If we have an address but no FID, use the wallet address with prefix
    console.log("Using wallet address as FID:", address);
    return `wallet-${address}`;
  }
  
  // Last resort, try any other Farcaster related IDs
  const fallbackId = String(
    context.fid || 
    context.user?.id || 
    context.frameContext?.fid ||
    ""
  );
  
  console.log("Using fallback ID:", fallbackId);
  return fallbackId;
}

export function getFarcasterUsername(context: any): string | undefined {
  if (!context) return undefined;
  
  // Try different possible paths for the username
  const farcasterUsername = context.username || 
    context.user?.username || 
    context.frameContext?.username;
    
  if (farcasterUsername) return farcasterUsername;
  
  // If no Farcaster username is found, try to get a shortened wallet address
  const address = context.connectedAddress || 
                 context.walletClient?.account?.address || 
                 '';
  
  if (address) {
    // Return a shortened version of the address like "0x1234...5678"
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  return undefined;
} 