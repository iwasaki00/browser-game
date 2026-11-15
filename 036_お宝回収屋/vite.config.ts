import { defineConfig } from 'vite';
export default defineConfig(({mode})=>({base:'./',define:{'import.meta.env.VITE_STATIC_DEBUG':JSON.stringify(mode==='debug'?'true':'false')},build:{outDir:mode==='debug'?'dist-debug':'dist'}}));
