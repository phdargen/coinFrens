import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const newParams = new URLSearchParams(searchParams);
  
  // Extract referrer address from query parameters if present
  const referrerAddress = searchParams.get('referrerAddress');
  const sellToken = searchParams.get('sellToken');
  
  // Remove referrerAddress from the parameters we will send to 0x
  if (referrerAddress) {
    newParams.delete('referrerAddress');
  }
  
  // Determine swapFeeRecipient
  let swapFeeRecipient = null;
  if (referrerAddress && referrerAddress.startsWith('0x')) {
    // Use the referrer address provided by the client
    swapFeeRecipient = referrerAddress;
  } else if (process.env.INTEGRATOR_WALLET_ADDRESS && 
             process.env.INTEGRATOR_WALLET_ADDRESS.startsWith('0x') &&
             process.env.INTEGRATOR_WALLET_ADDRESS !== '') {
    // Use default integrator wallet address from env
    swapFeeRecipient = process.env.INTEGRATOR_WALLET_ADDRESS;
  }
  
  // Get the swap fee percentage, default to 1% (100 basis points)
  const swapFeeBps = process.env.SWAP_FEE_BPS || '100';
  
  // Add fee parameters to the query parameters if recipient and sellToken are available
  if (swapFeeRecipient && sellToken) {
    newParams.append('swapFeeRecipient', swapFeeRecipient);
    newParams.append('swapFeeBps', swapFeeBps);
    newParams.append('swapFeeToken', sellToken); // Use the sell token for the fee
  }

  try {    
    const res = await fetch(
      `https://api.0x.org/swap/permit2/quote?${newParams}`,
      {
        headers: {
          "0x-api-key": process.env.ZEROEX_API_KEY as string,
          "0x-version": "v2",
        },
      }
    );
    const data = await res.json();

    console.log(
      "quote api call:",
      `https://api.0x.org/swap/permit2/quote?${newParams}`
    );
    
    console.log("quote response data:", data);

    return Response.json(data);
  } catch (error) {
    console.error("Error calling 0x quote API:", error);
    return Response.json({ error: "Failed to fetch quote data" }, { status: 500 });
  }
}
