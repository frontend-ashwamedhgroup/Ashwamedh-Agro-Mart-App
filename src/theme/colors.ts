/**
 * Application color palette.
 *
 * The application uses a neutral monochrome color system for both
 * light and dark themes. Semantic colors are provided separately
 * for states such as success, warning, and error.
 */

export const colors = {
  /**
   * Colors used when the application is in light mode.
   */
  light: {
    background: '#F8F8F8',
    surface: '#FFFFFF',
    border: '#E5E5E5',

    text: '#111111',
    textSecondary: '#666666',
    textMuted: '#707070',

    primary: '#111111',
    onPrimary: '#FFFFFF',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },

  /**
   * Colors used when the application is in dark mode.
   */
  dark: {
    background: '#0A0A0A',
    surface: '#171717',
    border: '#2A2A2A',

    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textMuted: '#737373',

    primary: '#FFFFFF',
    onPrimary: '#000000',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
} as const;

/**
 * Defines the structure shared by both light and dark color themes.
 *
 * String types are intentionally used instead of deriving the type
 * directly from colors.light. This allows both themes to provide
 * different color values while maintaining the same structure.
 */
export type ThemeColors = {
  background: string;
  surface: string;
  border: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  primary: string;
  onPrimary: string;

  success: string;
  warning: string;
  error: string;
};