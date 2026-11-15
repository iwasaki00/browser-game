// Compile-time capabilities. A normal artifact cannot enable them through a URL or a saved flag.
export const STATIC_DEBUG=import.meta.env?.VITE_STATIC_DEBUG==='true';
export const DEBUG_AVAILABLE=!!import.meta.env?.DEV||STATIC_DEBUG;
