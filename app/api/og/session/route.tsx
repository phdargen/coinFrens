import { ImageResponse } from 'next/og';

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
    const { searchParams } = new URL(request.url);
    
    const creatorName = searchParams.get('creatorName') || 'Unknown Creator';
    const status = searchParams.get('status') || 'pending';
    const maxParticipants = parseInt(searchParams.get('maxParticipants') || '4');
    const participantCount = parseInt(searchParams.get('participantCount') || '0');
    const coinName = searchParams.get('coinName') || '';
    const coinSymbol = searchParams.get('coinSymbol') || '';
    
    // Get logo URL from environment variable
    const logoUrl = process.env.NEXT_PUBLIC_IMAGE_URL;
    
    // Parse participants with working logic
    let participants: Array<{fid: string, username: string, pfpUrl: string}> = [];
    const participantsParam = searchParams.get('participants');
    if (participantsParam) {
      try {
        // Try to parse without decoding first, then with decoding if that fails
        try {
          participants = JSON.parse(participantsParam);
        } catch {
          participants = JSON.parse(decodeURIComponent(participantsParam));
        }
      } catch (e) {
        console.error('Failed to parse participants:', e);
        // Continue with empty participants array
      }
    }
    
    const remainingSpots = maxParticipants - participantCount;
    
    let title, subtitle;
    if (status === 'complete' && coinName) {
      title = `${coinName} (${coinSymbol})`;
      subtitle = 'Coin Created Successfully! 🎉';
    } else if (status === 'generating') {
      title = `Jam Session by ${creatorName}`;
      subtitle = 'Generating Coin... ⏳';
    } else {
      title = `Jam Session by ${creatorName}`;
      subtitle = `${remainingSpots} spot${remainingSpots === 1 ? '' : 's'} left`;
    }

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
            fontFamily: 'system-ui',
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
            <div style={{
              width: '160px',
              height: '160px',
              borderRadius: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="CoinJam Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{ fontSize: '60px' }}>🪙</div>
              )}
            </div>
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
            {title}
          </div>
          
          <div style={{ 
            fontSize: '18px', 
            color: '#94a3b8',
            textAlign: 'center',
            marginBottom: '40px',
          }}>
            {subtitle}
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
              
              if (hasParticipant && participant.pfpUrl) {
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
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid #0052FF',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <img
                        src={participant.pfpUrl}
                        alt={participant.username || 'Participant'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={() => {
                          // Fallback handled by Next.js OG
                        }}
                      />
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#e2e8f0',
                      textAlign: 'center',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {participant.username || `User ${participant.fid}`}
                    </div>
                  </div>
                );
              } else if (index < participantCount) {
                // Filled slot without image
                return (
                  <div
                    key={`filled-${index}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      border: '3px solid #0052FF',
                      backgroundColor: '#0052FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        fontSize: '32px',
                        color: 'white',
                      }}>
                        ✓
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#e2e8f0',
                      textAlign: 'center',
                    }}>
                      Joined
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
                      width: '120px',
                      height: '120px',
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
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                    </div>
                  </div>
                );
              }
            })}
          </div>
          
        </div>
      ),
      {
        ...size,
      }
    );
  } catch (e) {
    console.error('Failed to generate image:', e);
    
    return new ImageResponse(
      (
        <div style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1f2937',
          color: 'white',
          fontSize: '48px',
          fontFamily: 'system-ui',
        }}>
          CoinJam Session
        </div>
      ),
      { ...size }
    );
  }
}