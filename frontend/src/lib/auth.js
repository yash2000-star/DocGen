import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const loginWithGitHub = () => {
  return supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: "repo" // <-- THIS IS THE MAGIC WORD. It asks for repository access.
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

// --- NEW: PLG Orphan Sweeper ---
export async function claimOrphanProjects() {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  if (!user) return;

  // Supabase stores the GitHub username here when they log in via OAuth
  const githubUsername = user.user_metadata?.preferred_username || user.user_metadata?.user_name;

  if (githubUsername) {
    // Find any orphan projects matching this username and claim them!
    const { error } = await supabase
      .from('projects')
      .update({ user_id: user.id })
      .is('user_id', null)
      .eq('tenant_name', githubUsername);

    if (!error) {
      console.log(`🧹 Swept and claimed orphan projects for: ${githubUsername}`);
    } else {
      console.error("Failed to claim orphans:", error);
    }
  }
}