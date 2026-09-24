/**
 * Dark theme configuration.
 */

import { colors } from './colors';

export const darkTheme = {
  colors: colors.dark,
} as const;

export type DarkTheme = typeof darkTheme;