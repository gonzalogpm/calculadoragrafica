
import { createClient } from '@supabase/supabase-js';

// Intentar obtener variables de diferentes fuentes posibles en entornos Vite/Vercel/Navegador
const supabaseUrl = 
  (import.meta as any).env?.VITE_SUPABASE_URL || 
  (window as any).env?.VITE_SUPABASE_URL;

const supabaseAnonKey = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  (window as any).env?.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("Supabase no configurado. Las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY faltan en el entorno.");
}
