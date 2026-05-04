// Utility to generate deterministic patterns based on a seed string (e.g. event ID)

export function generatePattern(seed: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate colors based on hash - using warmer, more premium tones
  const c1 = Math.abs(hash) % 360;
  const c2 = (c1 + 40) % 360; // Analogous color
  const c3 = (c1 + 180) % 360; // Complementary

  const color1 = `hsl(${c1}, 75%, 55%)`;
  const color2 = `hsl(${c2}, 70%, 50%)`;
  const color3 = `hsl(${c3}, 65%, 45%)`;

  // Premium gradient patterns
  const patterns = [
    `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
    `linear-gradient(160deg, ${color1} 0%, ${color2} 50%, ${color3} 100%)`,
    `radial-gradient(ellipse at top left, ${color1}, ${color2} 70%)`,
    `linear-gradient(45deg, ${color1} 0%, ${color2} 50%, ${color1} 100%)`,
    `radial-gradient(circle at 30% 70%, ${color1}, ${color2})`,
  ];

  const patternIndex = Math.abs(hash) % patterns.length;
  
  return patterns[patternIndex];
}

// Alias for backward compatibility
export const generateEventPattern = generatePattern;

