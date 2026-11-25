// DetourLoop design system — tokens.
// Soft, airy look: warm off-white pages, white cards with large radii and very soft warm shadows,
// light-weight navy headlines, thin outline icons, navy pill buttons, sand accents.

export const color = {
  ocean: '#183C50',
  teal: '#285B65',
  sand: '#D7C5A7',
  cream: '#E9E4D9',
  charcoal: '#38352F',
  white: '#F8F7F3',
  gray: '#92979A',
  // derived
  ink: '#1E2A30',            // body text on light surfaces (≥ 12:1 on white)
  inkSoft: '#5B6366',        // secondary text (≥ 5.5:1 on white)
  line: 'rgba(24,60,80,0.12)',
  oceanDeep: '#0F2A38',
  sandDeep: '#B79F78',
  danger: '#A4442F',
  success: '#2F6B4F',
  scrim: 'rgba(12,24,32,0.55)',
  // surfaces
  paper: '#F4F1EC',          // page background (warm off-white)
  card: '#FFFFFF',
  tile: '#FBF8F3',           // icon tiles, quiet panels
  tileLine: 'rgba(183,159,120,0.22)',
  bar: 'rgba(250,246,240,0.97)', // floating tab bar
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
  hero: 46,
  h1: 36,
  h2: 27,
  h3: 20,
  body: 16,
  small: 14,
  micro: 12,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, md: 18, lg: 26, xl: 34, pill: 999 } as const;

export const shadow = {
  // Soft, warm, wide shadows — cards should look like they float on paper, not cast hard edges.
  card: {
    shadowColor: '#7A6648',
    shadowOpacity: 0.1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  float: {
    shadowColor: '#7A6648',
    shadowOpacity: 0.16,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  soft: {
    shadowColor: '#7A6648',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
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
