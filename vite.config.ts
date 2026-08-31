import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      'react-native-svg': 'react-native-svg',
      'react-native-qrcode-svg': path.resolve(__dirname, 'src/components/QRCodeShim.tsx'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
  },
  server: {
    port: 5173,
    host: true,
  },
});
