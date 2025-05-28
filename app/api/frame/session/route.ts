import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/og-utils';

// Mark this route as dynamic since it uses request.url
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract session parameters
    const sessionId = searchParams.get('sessionId') || '';
    const creatorName = searchParams.get('creatorName') || 'Unknown Creator';
    const status = searchParams.get('status') || 'incomplete';
    const maxParticipants = parseInt(searchParams.get('maxParticipants') || '4');
    const participantCount = parseInt(searchParams.get('participantCount') || '0');
    
    // Parse participant data
    const participantsParam = searchParams.get('participants');
    let participants: Array<{fid: string, username: string, pfpUrl: string}> = [];
    if (participantsParam) {
      try {
        participants = JSON.parse(decodeURIComponent(participantsParam));
      } catch (e) {
        console.error('Failed to parse participants:', e);
      }
    }
    
    // Get coin metadata if session is complete
    const coinName = searchParams.get('coinName') || '';
    const coinSymbol = searchParams.get('coinSymbol') || '';
    const coinImageUrl = searchParams.get('coinImageUrl') || '';

    const baseUrl = process.env.NEXT_PUBLIC_URL;
    
    // Generate OG image URL with session parameters
    const ogImageParams = new URLSearchParams({
      sessionId,
      creatorName,
      status,
      maxParticipants: maxParticipants.toString(),
      participantCount: participantCount.toString(),
    });
    
    // Add participants data if available
    if (participants.length > 0) {
      ogImageParams.set('participants', encodeURIComponent(JSON.stringify(participants)));
    }
    
    // Add coin metadata if session is complete
    if (status === 'complete' && coinName) {
      ogImageParams.set('coinName', coinName);
      ogImageParams.set('coinSymbol', coinSymbol);
      if (coinImageUrl) {
        ogImageParams.set('coinImageUrl', coinImageUrl);
      }
    }
    
    // Add timestamp for cache busting
    ogImageParams.set('t', Date.now().toString());
    
    const imageUrl = `${baseUrl}/api/og/session?${ogImageParams.toString()}`;
    
    // Generate session-specific URL for the frame button action
    const sessionPageUrl = `${baseUrl}/session/${sessionId}`;

    // Generate description based on session status
    let description = '';
    if (status === 'complete' && coinName) {
      description = `${coinName} (${coinSymbol}) has been created! View the coin and share your success.`;
    } else if (status === 'generating') {
      description = 'Coin is being generated... Check back soon!';
    } else {
      const remainingSpots = maxParticipants - participantCount;
      description = `Join ${creatorName}'s CoinJam session! ${remainingSpots} spot${remainingSpots === 1 ? '' : 's'} remaining.`;
    }

    // Frame object
    const frame = {
      version: "next",
      imageUrl,
      button: {
        title: status === 'complete' ? "View Coin 🪙" : status === 'generating' ? "Check Status ⏳" : "Join Session 🤝",
        action: {
          type: "launch_frame",
          name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
          url: sessionPageUrl,
          splashImageUrl: process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL,
          splashBackgroundColor: `#${process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR}`,
        },
      },
    };

    const frameJson = JSON.stringify(frame);
    const escapedFrameJson = escapeHtml(frameJson);
    
    // Escape data for HTML output
    const escapedDescription = escapeHtml(description);
    const sessionTitle = status === 'complete' && coinName 
      ? `${coinName} (${coinSymbol}) - CoinJoin Session`
      : `${creatorName}'s CoinJam Session - CoinJoin`;
    const escapedTitle = escapeHtml(sessionTitle);

    // HTML response
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapedTitle}</title>
          <meta property="og:title" content="${escapedTitle}">
          <meta property="og:description" content="${escapedDescription}">
          <meta property="og:image" content="${imageUrl}">
          <meta name="fc:frame" content='${escapedFrameJson}'>
        </head>
        <body>
          <h1>${escapedTitle}</h1>
          <p>${escapedDescription}</p>
          <img src="${imageUrl}" alt="Session Preview" style="max-width: 100%; height: auto;">
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache for dynamic session frames
      }
    });

  } catch (e) {
    console.error('Failed to generate session frame HTML:', e);
    return new NextResponse('Error generating frame', { status: 500 });
  }
} 