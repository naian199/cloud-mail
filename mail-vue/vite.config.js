import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'node:fs'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import {ElementPlusResolver} from 'unplugin-vue-components/resolvers'
import {VitePWA} from 'vite-plugin-pwa';
import { videoEngine } from './build/video-engine.mjs';

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), 'VITE')
    return {
        server: {
            host: true,
            port: 3001,
            hmr: true,
        },
        base: env.VITE_STATIC_URL || '/',
        plugins: [vue(), videoEngine(__dirname),
            {
                name: 'project-notices',
                generateBundle() {
                    for (const filename of ['LICENSE', 'NOTICE.md', 'licenses/webcrypto-web-push.MIT.txt']) {
                        this.emitFile({ type: 'asset', fileName: filename,
                            source: readFileSync(path.resolve(__dirname, '..', filename), 'utf8') });
                    }
                }
            },
            VitePWA({
                injectRegister: 'script-defer',
                strategies:'injectManifest',
                srcDir:'src',
                filename:'sw.js',
                manifest: {
                    id: '/',
                    start_url: '/mail-chat',
                    scope: '/',
                    display: 'standalone',
                    name: env.VITE_PWA_NAME || 'Cloud Mail',
                    short_name: env.VITE_PWA_NAME || 'Cloud Mail',
                    background_color: '#FFFFFF',
                    theme_color: '#FFFFFF',
                    icons: [
                        {
                            src: '/mail-brand-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'any',
                        },
                        {src:'/mail-brand-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
                        {src:'/mail-brand.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}
                    ],
                },
                injectManifest: { globPatterns: [], rollupFormat: 'iife' },
            }),
            AutoImport({
                resolvers: [ElementPlusResolver()],
            }),
            Components({
                resolvers: [ElementPlusResolver()],
            })
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        build: {
            target: 'es2022',
            outDir: env.VITE_OUT_DIR || 'dist',
            emptyOutDir: true,
            assetsInclude: ['**/*.json']
        }
    }
})
