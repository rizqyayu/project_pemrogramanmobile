import { Platform, ViewStyle } from 'react-native';

/**
 * EduStock Inventory — Modern Gen Z Soft Blue Gradient Design System
 */
export const UI = {
  colors: {
    primary: '#2563EB',
    primaryMid: '#3B82F6',
    primaryDark: '#1D4ED8',
    primaryLight: '#EFF6FF',
    primarySoft: '#DBEAFE',
    primaryBorder: '#BFDBFE',

    background: '#F4F8FF',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',

    text: '#0F172A',
    textBody: '#334155',
    secondary: '#64748B',
    muted: '#94A3B8',

    border: '#E2E8F0',
    borderSoft: '#E6EEFA',
    borderSubtle: '#F1F5F9',

    // Semantic indicators ONLY (status & warning)
    success: '#16A34A',
    successBg: '#F0FDF4',
    successBorder: '#BBF7D0',

    warning: '#F59E0B',
    warningDark: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',

    danger: '#EF4444',
    dangerDark: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  gradients: {
    pageBg: 'linear-gradient(165deg, #E6F0FF 0%, #F5F9FF 42%, #FFFFFF 100%)',
    headerSoft: 'linear-gradient(180deg, #EBF3FF 0%, #F8FBFF 100%)',
    primaryBtn: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 55%, #1D4ED8 100%)',
    primarySoft: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    logoBox: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    sheet: 24,
    pill: 999,
  },
  font: {
    mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
} as const;

export const cardShadow: ViewStyle = {
  shadowColor: '#1E40AF',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
};

export const primaryButtonShadow: ViewStyle = {
  shadowColor: '#2563EB',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.25,
  shadowRadius: 10,
  elevation: 4,
};
