import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/auth";

// 1. Create the Context
const AuthContext = createContext({});

// 2. Create the Provider Component
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for real-time login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show a loading screen while Supabase figures out who is logged in
  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}>
        <p style={{ fontSize: "18px", fontWeight: "500" }}>Loading DocGen...</p>
      </div>
    );
  }

  // 3. Broadcast the session and user to the app
  return (
    <AuthContext.Provider value={{ session, user }}>
      {children}
    </AuthContext.Provider>
  );
};

// 4. Create a custom hook so other files can grab the VIP wristband easily
export const useAuth = () => {
  return useContext(AuthContext);
};