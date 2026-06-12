import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Proxy target: DataHub frontend (Play Framework) on port 9002, which handles
// auth and proxies /api/* and /openapi/* to GMS — identical to datahub-web-react's dev setup.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:9002';

const proxyConfig = {
    target: PROXY_TARGET,
    changeOrigin: true,
};

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/logIn': proxyConfig,
            '/logOut': proxyConfig,
            '/authenticate': proxyConfig,
            '/signUp': proxyConfig,
            '/api': proxyConfig,
            '/openapi': proxyConfig,
        },
    },
});
