import { supabase } from './auth'; 

const API_URL = import.meta.env.VITE_API_URL;

let csrfToken = null;

async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
}

export async function apiFetch(endpoint, options = {}) {
    // --- NEW: Grab the Supabase Auth Token ---
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const csrf = await getCsrfToken();

    return fetch(`${API_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
            'Authorization': `Bearer ${token}`, // <-- Send the ID Badge!
            ...options.headers,
        },
    });
}