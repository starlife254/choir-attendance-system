// supabase-client.js
const SUPABASE_URL = 'https://skrvassehezrynudbahn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrcnZhc3NlaGV6cnludWRiYWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzUyMzAsImV4cCI6MjA5MjExMTIzMH0.iA93tmu9TCdmEhUxBLGRUE0fRdDha9-WPps8qNzd5a0';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth helper functions
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function getUserProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
        return profile;
    }
    return null;
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// Test the connection
(async () => {
    const { data, error } = await supabaseClient.from('members').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('Supabase connection error:', error);
    } else {
        console.log('Supabase connected successfully!');
    }
})();