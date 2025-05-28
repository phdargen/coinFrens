import { ImageResponse } from 'next/og';
import { loadGoogleFont, loadImage, generateFallbackAvatar } from '@/lib/og-utils';
import React from 'react';

// Force dynamic rendering for fresh image generation
export const dynamic = 'force-dynamic';

// Define the dimensions for the generated OpenGraph image
const size = {
  width: 1200,
  height: 630,
};

/**
 * GET handler for generating dynamic OpenGraph images for coin sessions
 * @param request - The incoming HTTP request with session data as query params
 * @returns ImageResponse - A dynamically generated image for OpenGraph
 */
export async function GET(request: Request) {
  try {
    // Get URL object to extract parameters
    const { searchParams } = new URL(request.url);
    console.log(request.url);
    
    // Extract session data from query parameters
    const sessionId = searchParams.get('sessionId') || '';
    const creatorName = searchParams.get('creatorName') || 'Unknown Creator';
    const status = searchParams.get('status') || 'incomplete';
    const maxParticipants = parseInt(searchParams.get('maxParticipants') || '4');
    const participantCount = parseInt(searchParams.get('participantCount') || '0');
    
    // Parse participant data from JSON
    let participants: Array<{fid: string, username: string, pfpUrl: string}> = [];
    const participantsParam = searchParams.get('participants');
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
    
    // Get the application's base URL from environment variables
    const appUrl = process.env.NEXT_PUBLIC_URL;
    
    // Load the main logo image with better error handling
    let logoImage: ArrayBuffer;
    try {
      const logoUrl = `${appUrl}/coinFrens.png`.replace(/\/+/g, '/').replace(':/', '://');
      logoImage = await loadImage(logoUrl);
    } catch (error) {
      console.error('Failed to load logo image, using fallback:', error);
      // Use a smaller fallback or skip the logo entirely
      logoImage = new ArrayBuffer(0);
    }
    
    // Load participant profile pictures
    const participantImages: (ArrayBuffer | null)[] = [];
    for (const participant of participants) {
      try {
        let imageUrl = participant.pfpUrl;
        if (!imageUrl) {
          imageUrl = generateFallbackAvatar(participant.username || participant.fid);
        }
        const imageBuffer = await loadImage(imageUrl);
        participantImages.push(imageBuffer);
      } catch (error) {
        console.error(`Failed to load image for participant ${participant.fid}:`, error);
        try {
          const fallbackUrl = generateFallbackAvatar(participant.username || participant.fid);
          const fallbackBuffer = await loadImage(fallbackUrl);
          participantImages.push(fallbackBuffer);
        } catch (fallbackError) {
          console.error(`Failed to load fallback image:`, fallbackError);
          participantImages.push(null);
        }
      }
    }
    
    // Load coin image if available
    let coinImageBuffer: ArrayBuffer | null = null;
    if (coinImageUrl) {
      try {
        if (coinImageUrl.startsWith('ipfs://')) {
          const ipfsUrl = coinImageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
          coinImageBuffer = await loadImage(ipfsUrl);
        } else {
          coinImageBuffer = await loadImage(coinImageUrl);
        }
      } catch (error) {
        console.error('Failed to load coin image:', error);
      }
    }
    
    // Load and prepare the custom font
    const displayText = `CoinJoin by ${creatorName}${coinName ? ` • ${coinName} (${coinSymbol})` : ''}`;
    const fontData = await loadGoogleFont('Inter', displayText);
    
    // Cache control 
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache for dynamic session images
    
    // Determine remaining spots and status text
    const remainingSpots = maxParticipants - participantCount;
    const statusText = status === 'complete' 
      ? 'Coin Created!' 
      : status === 'generating'
      ? 'Generating Coin...'
      : `${remainingSpots} spot${remainingSpots === 1 ? '' : 's'} left`;

    // Generate and return the image response with the composed elements
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1e3a8a 0%, #111827 100%)',
            color: 'white',
            fontFamily: 'Inter',
            padding: '40px',
          }}
        >
          {/* Header with logo */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            marginBottom: '30px',
            gap: '16px',
          }}>
            {logoImage.byteLength > 0 && (
              <img
                src={`data:image/png;base64,${Buffer.from(logoImage).toString('base64')}`}
                alt="CoinJoin Logo"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '100%',
                }}
              />
            )}
            <div style={{ 
              fontSize: '44px', 
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #0052FF, #40C7FF)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
            }}>
              CoinJam - Coin with your frens
            </div>
          </div>
          
          {/* Session info */}
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '8px',
          }}>
            {status === 'complete' && coinName
              ? `${coinName} (${coinSymbol})`
              : `Jam Session by ${creatorName}`}
          </div>
          
          <div style={{ 
            fontSize: '18px', 
            color: '#94a3b8',
            textAlign: 'center',
            marginBottom: '40px',
          }}>
            {statusText}
          </div>

          {/* Participants grid */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '30px',
            maxWidth: '800px',
          }}>
            {Array.from({ length: maxParticipants }, (_, index) => {
              const participant = participants[index];
              const hasParticipant = !!participant;
              const imageBuffer = participantImages[index];
              
              if (hasParticipant && imageBuffer) {
                return (
                  <div
                    key={`participant-${index}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid #0052FF',
                      backgroundColor: '#ffffff',
                    }}>
                      <img
                        src={`data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`}
                        alt={participant.username || 'Participant'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#e2e8f0',
                      textAlign: 'center',
                      maxWidth: '100px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {participant.username || `User ${participant.fid}`}
                    </div>
                  </div>
                );
              } else {
                // Empty slot
                return (
                  <div
                    key={`empty-${index}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      border: '3px dashed #475569',
                      backgroundColor: 'rgba(71, 85, 105, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        fontSize: '32px',
                        color: '#64748b',
                      }}>
                        ?
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#64748b',
                      textAlign: 'center',
                    }}>
                    </div>
                  </div>
                );
              }
            })}
          </div>

          {/* Coin preview for completed sessions */}
          {status === 'complete' && coinImageBuffer && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '20px',
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid #22c55e',
                backgroundColor: '#ffffff',
              }}>
                <img
                  src={`data:image/png;base64,${Buffer.from(coinImageBuffer).toString('base64')}`}
                  alt={coinName}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
              <div style={{
                fontSize: '20px',
                color: '#22c55e',
                fontWeight: 'bold',
              }}>
                Coin Successfully Created!
              </div>
            </div>
          )}
          
        </div>
      ),
      {
        ...size,
        headers,
        fonts: [
          {
            name: 'Inter',
            data: fontData,
            style: 'normal',
          },
        ],
      }
    );
  } catch (e) {
    console.error(`Failed to generate session image:`, e);
    
    // Redirect to the default image URL from environment variables
    const defaultImageUrl = process.env.NEXT_PUBLIC_IMAGE_URL;
    
    // If we have a default image URL, redirect to it
    if (defaultImageUrl) {
      return new Response('', {
        status: 302,
        headers: {
          'Location': defaultImageUrl,
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    // Fallback to a simple text response if no default image URL is available
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=300');
    
    return new ImageResponse(
      (
        <div style={{ 
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
          color: 'white',
          fontSize: '44px',
          textAlign: 'center',
          padding: '40px',
        }}>
          CoinJam
        </div>
      ),
      {
        ...size,
        headers,
      }
    );
  }
}