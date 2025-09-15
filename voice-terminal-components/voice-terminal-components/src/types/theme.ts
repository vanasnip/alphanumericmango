export type Theme = 'light' | 'dark';

export type Elevation = 'raised' | 'recessed' | 'flat';

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type Variant = 'primary' | 'secondary' | 'tertiary';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textBright: string;
}