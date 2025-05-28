// Utility functions to safely extract values from any Farcaster context structure
export function getFarcasterUserId(context: any): string {
  const fid = context?.user?.fid;
  
  if (fid) {
    console.log("Using fid:", fid);
    return String(fid);
  }
  
  if (!context) {
    return "";
  }
  
  // If no fid, try to get the wallet address
  const address = context?.connectedAddress || 
                 context?.walletClient?.account?.address || 
                 '';
  
  if (address) {
    console.log("Using wallet address as FID:", address);
    return `wallet-${address}`;
  }
  
  console.log("No valid FID or address found");
  return "";
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