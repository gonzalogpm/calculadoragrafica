
import { createClient } from '@supabase/supabase-js';

// Función para obtener variables de forma segura en cualquier entorno
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key] || (window as any).env?.[key] || "";
  } catch {
    return "";
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Solo creamos el cliente si ambas variables existen y no son strings vacíos
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("⚠️ CreaStickers: Supabase no detectado. Revisa las Variables de Entorno (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) en tu panel de deploy.");
}
