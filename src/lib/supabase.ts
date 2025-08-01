import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jbdiidhseumjqdfxyzop.supabase.co";
const supabaseAnonKey ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGlpZGhzZXVtanFkZnh5em9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NDgzNDQsImV4cCI6MjA2ODAyNDM0NH0.y5MNvcOeRODXLHgPmLN1osf6RI4E-Rx6rDrfdqsll9k";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);