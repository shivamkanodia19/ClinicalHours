# Deploying Supabase Edge Functions

## Quick Check: Which Backend Are You Using?

1. Open your project in Lovable
2. Click the **Cloud** icon in the top bar
3. Check if it says:
   - **"Lovable Cloud"** → Functions are managed by Lovable (see Option 1 below)
   - **"Your Own Supabase Project"** → Use Supabase CLI (see Option 2 below)

---

## Option 1: Deploy via Lovable Cloud (If using Lovable-managed backend)

### Automatic Deployment
Lovable Cloud should automatically detect and deploy functions from the `supabase/functions/` directory when you:
- Push code to your repository
- Deploy through Lovable's deployment interface

### Manual Deployment (if needed)
1. In Lovable editor, go to **Cloud** → **Functions**
2. You should see your functions listed
3. Click **Deploy** or **Sync** to deploy all functions

### Verify Functions Are Deployed
After deployment, test the endpoints:
```bash
# Test csrf-token
curl https://sysbtcikrbrrgafffody.supabase.co/functions/v1/csrf-token

# Test auth-cookie (requires auth)
curl -X POST https://sysbtcikrbrrgafffody.supabase.co/functions/v1/auth-cookie \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"YOUR_TOKEN"}'
```

---

## Option 2: Deploy via Supabase CLI (If using your own Supabase project)

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref sysbtcikrbrrgafffody
   ```

### Deploy Functions

Deploy all three new functions:

```bash
# Deploy csrf-token function
supabase functions deploy csrf-token

# Deploy auth-cookie function
supabase functions deploy auth-cookie

# Deploy logout function
supabase functions deploy logout
```

Or deploy all functions at once:
```bash
supabase functions deploy
```

### Verify Deployment
Check the Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/sysbtcikrbrrgafffody
2. Navigate to **Edge Functions**
3. Verify `csrf-token`, `auth-cookie`, and `logout` are listed

---

## Troubleshooting

### Functions Return 404
- **Lovable Cloud**: Check Cloud → Functions section, ensure functions are synced
- **Own Supabase**: Verify deployment succeeded with `supabase functions list`

### CORS Errors
- Ensure functions use `getCorsHeaders()` from `_shared/auth.ts`
- Check that `ALLOWED_ORIGINS` includes your domain

### Functions Not Found
- Verify function names match exactly: `csrf-token`, `auth-cookie`, `logout`
- Check `supabase/config.toml` has entries for all functions

---

## Testing After Deployment

1. **Test Sign-In Flow**:
   - Sign in at `/auth`
   - Check Network tab → should see `auth-cookie` request succeed
   - Check Application → Cookies → should see `session` and `csrf-token` cookies

2. **Test CSRF Protection**:
   - While logged in, perform actions (save opportunity, update profile)
   - Check Network tab → POST requests should include `X-CSRF-Token` header
   - Requests should succeed (not 403 CSRF error)

3. **Test Logout**:
   - Click logout
   - Cookies should be cleared
   - Should redirect to home page

---

## Need Help?

- **Lovable Cloud**: Check Lovable documentation or support
- **Supabase CLI**: Run `supabase functions --help` for commands
- **Supabase Dashboard**: https://supabase.com/dashboard/project/sysbtcikrbrrgafffody/functions

