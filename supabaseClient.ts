
import { createClient } from '@supabase/supabase-js';

// Estas variables deben configurarse en el panel de Vercel (Settings > Environment Variables)
// El uso de ?. evita el error "Cannot read properties of undefined"
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Si las variables están vacías, el cliente se creará pero las peticiones fallarán hasta que se configuren
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
