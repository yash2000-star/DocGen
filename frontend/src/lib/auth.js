import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// 1. GitHub OAuth
export const loginWithGitHub = () => {
  return supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: "http://localhost:5173/dashboard" 
    }
  });
};

// 2. Send 6-Digit OTP Email
export const sendOTP = (email) => {
  return supabase.auth.signInWithOtp({ email });
};

// 3. Verify the 6-Digit OTP Code
export const verifyOTP = (email, token) => {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
};

// 4. Session Helpers
export const getUser = () => supabase.auth.getUser();
export const logout = () => supabase.auth.signOut();