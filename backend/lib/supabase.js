// One shared Supabase client (service role) for the backend and the build worker.
const { createClient } = require("@supabase/supabase-js");
const { config, assertRequiredConfig } = require("../config");

assertRequiredConfig();

const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
