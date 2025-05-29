import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {    
    const res = await fetch(
      `https://api.0x.org/swap/permit2/price?${searchParams}`,
      {
        headers: {
          "0x-api-key": process.env.ZEROEX_API_KEY as string,
          "0x-version": "v2",
        },
      }
    );
    const data = await res.json();
    console.log(
      "price api call:",
      `https://api.0x.org/swap/permit2/price?${searchParams}`
    );
    console.log("price response data:", data);

    return Response.json(data);
  } catch (error) {
    console.error("Error calling 0x price API:", error);
    return Response.json({ error: "Failed to fetch price data" }, { status: 500 });
  }
}