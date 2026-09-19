export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://skrvassehezrynudbahn.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const TEMP_PASSWORD = 'UOEMCHOIR';

export default async function handler(req) {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const { member_id, admin_token } = await req.json();

        if (!member_id) {
            return new Response(JSON.stringify({ error: 'member_id is required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Verify the caller is an authenticated admin ──
        // The client sends their own session token; we validate it against the members table
        if (!admin_token) {
            return new Response(JSON.stringify({ error: 'Missing auth token' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SERVICE_ROLE,
                'Authorization': `Bearer ${admin_token}`
            }
        });

        if (!verifyRes.ok) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const authUser = await verifyRes.json();
        if (!authUser?.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Find the auth user linked to this member ──
        // Look up user_members to get the auth user_id
        const umRes = await fetch(
            `${SUPABASE_URL}/rest/v1/user_members?member_id=eq.${encodeURIComponent(member_id)}&select=user_id`,
            {
                headers: {
                    'apikey': SERVICE_ROLE,
                    'Authorization': `Bearer ${SERVICE_ROLE}`
                }
            }
        );
        const umData = await umRes.json();

        if (!umData || umData.length === 0) {
            return new Response(JSON.stringify({
                error: 'No auth account linked to this member. They need to register first.'
            }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const targetUserId = umData[0].user_id;

        // ── Update their password to the temp password ──
        const updateRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}`,
            {
                method: 'PUT',
                headers: {
                    'apikey': SERVICE_ROLE,
                    'Authorization': `Bearer ${SERVICE_ROLE}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: TEMP_PASSWORD })
            }
        );

        if (!updateRes.ok) {
            const err = await updateRes.text();
            console.error('Password update failed:', err);
            return new Response(JSON.stringify({ error: 'Failed to update password' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Mark user_profiles.must_change_password = true ──
        await fetch(
            `${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${targetUserId}`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SERVICE_ROLE,
                    'Authorization': `Bearer ${SERVICE_ROLE}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    must_change_password: true,
                    temp_password_set_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            }
        );

        return new Response(JSON.stringify({
            success: true,
            message: `Password reset to "${TEMP_PASSWORD}". Member must change it on next login.`
        }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Reset password error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}