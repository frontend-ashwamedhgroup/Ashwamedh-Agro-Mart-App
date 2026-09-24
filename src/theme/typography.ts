/**
 * Standard text styles used throughout the app.
 */

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
  },

  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
  },

  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
  },

  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },

  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
  },

  button: {
    fontSize: 16,
    fontWeight: '600' as const,
  },

  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
} as const;

export type Typography = typeof typography;