/**
 * Light theme configuration.
 */

import { colors } from './colors';

export const lightTheme = {
  colors: colors.light,
} as const;

export type LightTheme = typeof lightTheme;