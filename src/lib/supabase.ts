import {createClient} from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rtisjkrsdbxgrqjgrlgk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0aXNqa3JzZGJ4Z3JxamdybGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MDk0NTEsImV4cCI6MjA1NzQ4NTQ1MX0.Wx9p5BOxC_6igBDn4JSWL2jh425kfSNzdVECt4VWX5w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

export async function safeSupabaseOperation(operation: () => any) {
  try {
    return await operation();
  } catch (error) {
    console.error('Supabase operation error:', error);
    return {data: null, error};
  }
}
