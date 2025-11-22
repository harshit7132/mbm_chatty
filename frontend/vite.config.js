import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Generates self-signed certificates for HTTPS in development
  ],
  server: {
    // HTTPS is enabled via the basicSsl plugin above
    // This allows camera/microphone access which requires secure context
      proxy: {
        // Proxy API requests to backend to avoid mixed content issues
        // Vite proxy automatically handles HTTPS frontend → HTTP backend
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          secure: false, // Allow self-signed certificates (for HTTPS frontend)
        },
      },
  },
})
