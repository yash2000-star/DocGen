import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const loginWithGitHub = () => {
  return supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: "http://localhost:5173/dashboard" 
    }
  });
};

export const sendOTP = (email) => {
  return supabase.auth.signInWithOtp({ email });
};


export const verifyOTP = (email, token) => {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
};

// 4. Session Helpers
export const getUser = () => supabase.auth.getUser();
export const logout = () => supabase.auth.signOut();

// --- NEW: Enterprise Session Hardening ---
export async function handleFirstLogin(user) {
  // Check if user already exists in our users table
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existing) return;  // Already saved — skip

  // First login — save user data
  await supabase.from('users').insert({
    id:              user.id,
    email:           user.email,
    full_name:       user.user_metadata?.full_name  || '',
    github_username: user.user_metadata?.user_name  || '',
    avatar_url:      user.user_metadata?.avatar_url || '',
    created_at:      new Date().toISOString(),
  });
}