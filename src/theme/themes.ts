export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  primary: string;
  primaryDark: string;
  accent: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;
  bubbleOwn: string;
  bubbleOther: string;
  bubbleShadow: string;
  badge: string;
  danger: string;
  glass: string;
  glassBorder: string;
  glassHighlight: string;
  orb1: string;
  orb2: string;
  orb3: string;
  statusBar: 'light-content' | 'dark-content';
}

export const lightTheme: AppTheme = {
  mode: 'light',
  primary: '#3390EC',
  primaryDark: '#2481DC',
  accent: '#54A9EB',
  background: '#EEF2F8',
  backgroundAlt: '#F8FAFD',
  surface: '#FFFFFF',
  divider: 'rgba(0,0,0,0.06)',
  textPrimary: '#0C1117',
  textSecondary: '#5E6470',
  textTertiary: '#9BA3AF',
  textOnPrimary: '#FFFFFF',
  bubbleOwn: '#E3F4D8',
  bubbleOther: '#FFFFFF',
  bubbleShadow: 'rgba(0,0,0,0.06)',
  badge: '#3390EC',
  danger: '#E53935',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.95)',
  glassHighlight: 'rgba(255,255,255,0.45)',
  orb1: 'rgba(51,144,236,0.35)',
  orb2: 'rgba(120,180,255,0.28)',
  orb3: 'rgba(180,140,255,0.22)',
  statusBar: 'dark-content',
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  primary: '#5EB3F6',
  primaryDark: '#3390EC',
  accent: '#7CC4FF',
  background: '#07070C',
  backgroundAlt: '#0E0E16',
  surface: '#14141F',
  divider: 'rgba(255,255,255,0.08)',
  textPrimary: '#F4F4F8',
  textSecondary: '#A8AEB8',
  textTertiary: '#6B7280',
  textOnPrimary: '#FFFFFF',
  bubbleOwn: '#1A3D2E',
  bubbleOther: '#181822',
  bubbleShadow: 'rgba(0,0,0,0.35)',
  badge: '#5EB3F6',
  danger: '#FF6B6B',
  glass: 'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassHighlight: 'rgba(255,255,255,0.06)',
  orb1: 'rgba(51,144,236,0.22)',
  orb2: 'rgba(100,120,255,0.18)',
  orb3: 'rgba(180,100,255,0.14)',
  statusBar: 'light-content',
};
