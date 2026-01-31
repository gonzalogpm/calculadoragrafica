import { createClient } from '@supabase/supabase-js';

// Intentamos obtener las variables de Vite o del proceso
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Solo inicializamos si la URL es válida (empieza por http)
// Esto evita el error "supabaseUrl is required" que bloquea la app
export const supabase = (supabaseUrl && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
