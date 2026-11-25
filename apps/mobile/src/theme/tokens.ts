// DetourLoop design system — tokens.
// Ocean blue + charcoal carry the interface; sand + cream are the editorial / TravelReplay surfaces.

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
} as const;

export const font = {
  display: 'Roboto_700Bold',
  displayItalic: 'Roboto_700Bold_Italic',
  body: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  semibold: 'Roboto_600SemiBold',
  bold: 'Roboto_700Bold',
} as const;

export const size = {
  hero: 44,
  h1: 34,
  h2: 26,
  h3: 20,
  body: 16,
  small: 14,
  micro: 12,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#0F2A38',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  float: {
    shadowColor: '#0F2A38',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
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
