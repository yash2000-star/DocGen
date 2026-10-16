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

// The user's GitHub username, from their linked GitHub identity (null if they signed in
// with email only). Read from identities, not user_metadata, which users can edit.
// The database applies the same rule: docs for github.com/<owner>/<repo> belong to <owner>.
export function getGithubLogin(user) {
  const github = user?.identities?.find((identity) => identity.provider === "github");
  return github?.identity_data?.user_name || github?.identity_data?.preferred_username || null;
}

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

  const githubUsername = getGithubLogin(user);

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