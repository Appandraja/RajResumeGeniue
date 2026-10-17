import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const fontStack = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const theme = extendTheme({
  config,
  fonts: {
    heading: fontStack,
    body: fontStack,
  },
  colors: {
    brand: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
        // Keep content clear of the status/navigation bars on Android (edge-to-edge).
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      },
    },
  },
  components: {
    Button: { defaultProps: { colorScheme: 'brand' } },
  },
});
