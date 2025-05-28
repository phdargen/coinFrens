/**
 * Utility functions for generating OpenGraph images
 */

/**
 * Load a Google Font for use in OpenGraph image generation
 * @param fontFamily - The font family name (e.g., 'Inter')
 * @param text - The text that will be rendered with this font
 * @returns Promise resolving to the font data as ArrayBuffer
 */
export async function loadGoogleFont(fontFamily: string, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;700&display=swap`;

  const css = await (
    await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
      },
    })
  ).text();

  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/
  );

  if (!resource) {
    throw new Error('Failed to load font');
  }

  const res = await fetch(resource[1]);
  return res.arrayBuffer();
}

/**
 * Load an image from a URL and return it as ArrayBuffer
 * @param imageUrl - The URL of the image to load
 * @returns Promise resolving to the image data as ArrayBuffer
 */
export async function loadImage(imageUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to load image: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}

/**
 * Format a number as a percentage with one decimal place
 * @param value - The numeric value to format (0-1 range)
 * @returns Formatted percentage string
 */
export function formatAsPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Safely escape HTML characters in a string
 * @param unsafe - The string to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate a fallback avatar URL using DiceBear API
 * @param seed - The seed for generating the avatar
 * @returns Avatar URL
 */
export function generateFallbackAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
} 