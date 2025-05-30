export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  return Response.json({
    accountAssociation: {
      header: "eyJmaWQiOjM3MjA4OCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDhmOWQwNTQ3YmY3ODkzMWNEOEJCMzQyODU5YTNmNzg3OTc5MDMzQkYifQ",
      payload: "eyJkb21haW4iOiJjb2luLWZyZW5zLnZlcmNlbC5hcHAifQ",
      signature: "MHgwOTc5ZmE5Nzc1ZWVjZTM4NmE3ZGUwMjE4ZTkwZDhjMTE0YTViMmQyZDRkMjZiYTIzMmU0MWNmODc5NTY5M2FlMGQ5MGQwYmNiOWE0MGZjZDgzYzViNTA2MjMxNzQ0MWNiMjdlNjkzZWY3ODZmNTRmYmRhODJlZjdlOTg0YmFkOTFi"
    },
    frame: {
      version: process.env.NEXT_PUBLIC_VERSION,
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
      homeUrl: URL,
      iconUrl: process.env.NEXT_PUBLIC_ICON_URL,
      imageUrl: process.env.NEXT_PUBLIC_IMAGE_URL,
      buttonTitle: `Coin with your frens`,
      splashImageUrl: process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL,
      splashBackgroundColor: `#${process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR}`,
      webhookUrl: `${URL}/api/webhook`,
      tagline: "Coin with your frens",
      subtitle: "Coin with your frens",
      description: "CoinJam - Coin with your frens",
      heroImageUrl: `${URL}/session.png`,
      primaryCategory: "social",
      tags: [
        "social",
        "friends",
        "community",
        "gaming",
        "fun"
      ],
      ogTitle: "CoinJam - Coin with your frens",
      ogDescription: "CoinJam - Coin with your frens",
      ogImageUrl: `${URL}/session.png`,
    },
  });
}
