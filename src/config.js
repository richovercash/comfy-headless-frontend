// src/config.js
const config = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    comfyUiApi: import.meta.env.VITE_COMFY_UI_API || 'http://localhost:8188/api',
  };
  
  export default config;