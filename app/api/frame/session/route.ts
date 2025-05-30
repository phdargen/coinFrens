import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-client';

// Mark this route as dynamic since it uses request.url
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return new NextResponse('Session ID is required', { status: 400 });
    }

    // Fetch session data internally
    const session = await getSession(sessionId);
    
    if (!session) {
      return new NextResponse('Session not found', { status: 404 });
    }

    // Extract data from session
    const creatorName = session.creatorName || 'Unknown Creator';
    const status = session.status;
    const maxParticipants = session.maxParticipants;
    const participants = session.participants || {};
    const participantCount = Object.keys(participants).length;
    const coinName = session.metadata?.name || '';
    const coinSymbol = session.metadata?.symbol || '';

    const baseUrl = process.env.NEXT_PUBLIC_URL;
    
    // For local development, override with localhost if baseUrl is production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const effectiveBaseUrl = isDevelopment ? 'http://localhost:3000' : baseUrl;
    
    // Simple OG image URL - only pass sessionId
    const ogImageParams = new URLSearchParams({
      sessionId,
    });
    
    // Fix double slash issue by ensuring baseUrl doesn't end with slash when concatenating
    const cleanBaseUrl = effectiveBaseUrl?.endsWith('/') ? effectiveBaseUrl.slice(0, -1) : effectiveBaseUrl;
    const imageUrl = `${cleanBaseUrl}/api/og/session?${ogImageParams.toString()}`;
    const joinPageUrl = `${cleanBaseUrl}/join/${sessionId}`;

    // Simple description
    const remainingSpots = maxParticipants - participantCount;
    let description = '';
    if (status === 'complete' && coinName) {
      description = `${coinName} (${coinSymbol}) has been created!`;
    } else if (status === 'generating') {
      description = 'Coin is being generated...';
    } else {
      description = `Join ${creatorName}'s CoinJam session! ${remainingSpots} spot${remainingSpots === 1 ? '' : 's'} remaining.`;
    }

    const frame = {
      version: "next",
      imageUrl,
      button: {
        title: status === 'complete' ? "View Coin 🪙" : status === 'generating' ? "Check Status ⏳" : "Join Coin 🤝",
        action: {
          type: "launch_frame",
          name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || "CoinJam",
          url: status === 'complete' ? `${cleanBaseUrl}/session/${sessionId}` : joinPageUrl,
          splashImageUrl: process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL,
          splashBackgroundColor: `#${process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR || '667eea'}`,
        },
      },
    };

    const title = status === 'complete' && coinName 
      ? `${coinName} (${coinSymbol}) - CoinJam Session`
      : `${creatorName}'s CoinJam Session`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <meta property="og:title" content="${title}">
          <meta property="og:description" content="${description}">
          <meta property="og:image" content="${imageUrl}">
          <meta name="fc:frame" content='${JSON.stringify(frame)}'>
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #000;
            }
            img {
              max-width: 100vw;
              max-height: 100vh;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="Session Preview">
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300'
      }
    });

  } catch (e) {
    console.error('Failed to generate session frame HTML:', e);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head><title>CoinJam Session</title></head>
        <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
          <div style="color:white; text-align:center;">
            <h1>CoinJam Session</h1>
            <p>Something went wrong loading the session details.</p>
          </div>
        </body>
      </html>
    `, { 
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
} 