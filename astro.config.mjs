import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { alphaTab } from '@coderline/alphatab-vite';

// https://astro.build/config
export default defineConfig({
    vite: {
        plugins: [tailwindcss(), alphaTab({ assetOutputDir: 'public/alphatab' })],
        optimizeDeps: {
            exclude: ['@coderline/alphatab']
        }
    },
    integrations: [react()],
    adapter: netlify()
});
