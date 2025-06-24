import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extract the path from the URL pathname
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Remove the /api/warpcast/ prefix to get the actual path
    const path = pathname.replace('/api/warpcast/', '');
    const searchParams = url.searchParams.toString();
    
    // Build the Warpcast API URL
    const warpcastUrl = `https://api.warpcast.com/${path}${searchParams ? `?${searchParams}` : ''}`;
    
    console.log('Proxying request to:', warpcastUrl);
    
    // Forward the request to Warpcast API
    const response = await fetch(warpcastUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Warpcast API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Warpcast API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to Warpcast API' },
      { status: 500 }
    );
  }
} 