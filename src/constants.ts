// Contract addresses
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const; // Base USDC
export const NATIVE_ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// Prompt limits
export const MAX_PROMPT_LENGTH = 280 as const;

export const SESSION_STYLES = [
  "None", 
  "Custom",
  "Ghibli", 
  "Cyberpunk", 
  "Pixel Art", 
  "Ukiyo-e", 
  "Neoimpressionism",
  "Vaporwave",
  "Art Deco",
  "Pop Art", 
  "Anime",
  "Comic Book",
  "Graffiti",
  "Synthwave",
  "Watercolor",
  "Minimalist",
  "Surrealist",
] as const;

// Enhanced style descriptions for AI image generation
export const ART_STYLE_DESCRIPTIONS: Record<string, string> = {
  "Ghibli": "Studio Ghibli style in modern setting. Whimsical, hand-drawn animation aesthetic, soft colors, detailed natural elements, magical realism atmosphere.",
  "Cyberpunk": "Cyberpunk aesthetic, neon lighting, moody cinematic color grading, deep shadows, high contrast, vibrant purples and blues, atmospheric glow, reflective surfaces, soft focus, futuristic urban texture.",
  "Pixel Art": "Retro pixel art style, 16-bit video game aesthetic, limited color palette, crisp geometric shapes, nostalgic gaming vibe, detailed sprite-work.",
  "Ukiyo-e": "Traditional Japanese woodblock print texture, flat colors, bold outlines in an contemporary composition, traditional Japanese artistic techniques with modern subjects.",
  "Neoimpressionism": "Combine Impressionist and Post-Impressionist techniques with modern imagery, creating a fusion of Van Gogh's style with contemporary art, visible brushstrokes, vibrant colors, emotional expression.",
  "Vaporwave": "Vaporwave aesthetic, retro-futuristic synthwave vibes, neon pink and cyan gradients, geometric grids, marble textures, 80s nostalgia, dreamy pastel colors, glitch effects.",
  "Art Deco": "Art Deco style, geometric patterns, bold lines, metallic gold and black color scheme, luxury and elegance, symmetrical compositions, ornate decorative elements, 1920s glamour.",
  "Pop Art": "Pop Art style reminiscent of Andy Warhol and Roy Lichtenstein, bold primary colors, comic book aesthetics, halftone dots, high contrast, graphic design elements, modern commercial art.",
  "Anime": "Modern anime art style, vibrant colors, expressive characters, clean line work, dynamic poses, manga-inspired aesthetics, detailed eyes, contemporary Japanese animation style.",
  "Comic Book": "Comic book illustration style, bold outlines, dynamic action poses, speech bubbles removed, vibrant superhero colors, dramatic lighting, graphic novel aesthetics.",
  "Graffiti": "Street art graffiti style, urban wall textures, spray paint effects, bold lettering incorporated into design, vibrant colors, underground culture aesthetics, raw artistic expression.",
  "Synthwave": "Synthwave retro-futuristic style, neon outlines, dark backgrounds with bright accent colors, 80s sci-fi aesthetics, grid patterns, sunset gradients, electronic music culture vibes.",
  "Watercolor": "Watercolor painting technique, soft flowing colors, organic textures, translucent layers, artistic brush strokes, dreamy and ethereal quality, traditional painting medium.",
  "Minimalist": "Minimalist design aesthetic, clean lines, simple geometric shapes, limited color palette, lots of white space, modern and elegant, focus on essential elements only.",
  "Surrealist": "Surrealist art style inspired by Salvador Dalí and René Magritte, dreamlike imagery, impossible combinations, melting forms, bizarre juxtapositions, subconscious exploration."
} as const;

export const MAX_CUSTOM_STYLE_LENGTH = 100 as const; 