import { supabase } from './auth'; 

const API_URL = import.meta.env.VITE_API_URL;

// Calls the DocGen backend as the signed-in user. The Supabase access token goes in the
// Authorization header, which browsers never send on their own, so other sites can't make
// requests on the user's behalf.
export async function apiFetch(endpoint, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    return fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
}
