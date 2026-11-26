// DetourLoop design system — tokens.
// Clean look: white pages, neutral grey surfaces, modest corner radii, crisp low shadows,
// navy type and buttons, sand used sparingly as an accent (never as a background behind text).

export const color = {
  ocean: '#183C50',
  teal: '#285B65',
  sand: '#D7C5A7',
  cream: '#EEF1F2',          // quiet neutral fill (was warm tan)
  charcoal: '#38352F',
  white: '#F8F7F3',
  gray: '#92979A',
  // derived
  ink: '#1E2A30',            // body text on light surfaces (≥ 12:1 on white)
  inkSoft: '#5B6366',        // secondary text (≥ 5.5:1 on white)
  line: 'rgba(24,60,80,0.12)',
  oceanDeep: '#0F2A38',
  sandDeep: '#8A7350',       // accent text; dark enough to read on white
  danger: '#A4442F',
  success: '#2F6B4F',
  scrim: 'rgba(12,24,32,0.55)',
  // surfaces
  paper: '#FFFFFF',          // page background
  card: '#FFFFFF',
  tile: '#F4F6F7',           // icon tiles, quiet panels (neutral grey)
  tileLine: 'rgba(15,30,40,0.09)',
  bar: '#FFFFFF',            // tab bar
} as const;

export const font = {
  display: 'Roboto_300Light',          // big headlines are thin
  displayItalic: 'Roboto_300Light_Italic',
  light: 'Roboto_300Light',
  body: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  semibold: 'Roboto_600SemiBold',
  bold: 'Roboto_700Bold',
} as const;

export const size = {
  hero: 34,
  h1: 28,
  h2: 21,
  h3: 17,
  body: 15,
  small: 13,
  micro: 11.5,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 18, pill: 999 } as const;

export const shadow = {
  // Crisp, neutral, low shadows.
  card: {
    shadowColor: '#0B1A22',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  float: {
    shadowColor: '#0B1A22',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  soft: {
    shadowColor: '#0B1A22',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const touch = 48;

export const motion = {
  quick: 160,
  base: 260,
  slow: 520,
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
} as const;
