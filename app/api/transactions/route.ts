import { NextResponse } from "next/server";
import { recordUserTransaction, recordAddressTransaction, recordAllTransactions, CoinTransaction, getUserTransactions, getAddressTransactions, getAllTransactions } from "@/lib/transactions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      txHash, 
      coinAddress,
      coinName,
      coinSymbol,
      fid, 
      username,
      address, 
      ethAmount,
      usdAmount,
      action = "buy"
    } = body;
    
    // Validate required fields
    if (!txHash || !coinAddress || !ethAmount) {
      return NextResponse.json({ 
        error: "Missing required fields: txHash, coinAddress, ethAmount" 
      }, { 
        status: 400 
      });
    }
    
    if (!fid && !address) {
      return NextResponse.json({ 
        error: "Either fid or address must be provided" 
      }, { 
        status: 400 
      });
    }
    
    // Create transaction record
    const transaction: CoinTransaction = {
      txHash,
      timestamp: Date.now(),
      coinAddress,
      coinName: coinName || "Unknown Coin",
      coinSymbol: coinSymbol || "COIN",
      fid: fid || undefined,
      username: username || null,
      address: address || null,
      ethAmount,
      usdAmount: usdAmount || undefined,
      action
    };
    
    // Record the transaction based on available identifier
    if (fid) {
      await recordUserTransaction(fid, transaction);
    } 
    
    if (address) {
      await recordAddressTransaction(address, transaction);
    }
    
    // Always record in global transactions
    await recordAllTransactions(transaction);
    
    console.log(`Successfully recorded transaction: ${txHash} for ${coinSymbol}`);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error recording transaction:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, {
      status: 500
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const address = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '50');

    let transactions: CoinTransaction[] = [];

    if (fid) {
      transactions = await getUserTransactions(fid);
    } else if (address) {
      transactions = await getAddressTransactions(address);
    } else {
      transactions = await getAllTransactions(limit);
    }

    return NextResponse.json({ 
      success: true, 
      transactions,
      count: transactions.length 
    });

  } catch (error) {
    console.error("Error retrieving transactions:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, {
      status: 500
    });
  }
} 