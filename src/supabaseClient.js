import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ivzwvmkvpabmdjzxkvqi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OyDJZp2vuT8ymUJ46vxQVg_IRkGMOet';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
