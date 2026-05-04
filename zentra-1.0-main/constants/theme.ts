export const theme = {
  colors: {
    background: '#121212',
    primary: '#FF6A00',
    primaryDark: '#B10E0E',
    secondary: '#B3B3B3',
    info: '#3A7CA5',
    white: '#FFFFFF',
    card: '#1E1E1E',
    inactive: '#3A3A3A',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  shadow: {
    default: {
      shadowColor: '#FF6A00',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
    },
    hover: {
      shadowColor: '#FF6A00',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 10,
    },
  },
} as const;
