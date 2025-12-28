# Mapbox Token Security

## Overview

The application uses a Mapbox public token (`VITE_MAPBOX_PUBLIC_TOKEN`) for displaying interactive maps. This token is intentionally exposed in client-side code, which is the standard practice for Mapbox public tokens.

## Security Requirements

### ✅ Current Implementation

- Token is stored in environment variable: `VITE_MAPBOX_PUBLIC_TOKEN`
- Token is used in client-side code: `src/components/OpportunityMap.tsx`
- Token is a **public token** (starts with `pk.`), which is designed for client-side use

### ⚠️ CRITICAL: URL Restrictions Required

**The Mapbox public token MUST have URL restrictions configured in the Mapbox dashboard to prevent abuse.**

Without URL restrictions, anyone can copy your token and use it on their own websites, leading to:
- Unexpected charges on your Mapbox account
- Token abuse and potential rate limiting
- Security vulnerabilities

## How to Configure URL Restrictions

1. **Log in to Mapbox Dashboard**
   - Go to https://account.mapbox.com/
   - Navigate to your tokens/access tokens

2. **Find Your Public Token**
   - Locate the token that matches `VITE_MAPBOX_PUBLIC_TOKEN`
   - Click "Edit" or "Settings"

3. **Add URL Restrictions**
   - In the "URL restrictions" section, add your production domain(s):
     - `https://yourdomain.com/*`
     - `https://*.yourdomain.com/*`
     - For Lovable deployments: `https://*.lovableproject.com/*`
     - For local development: `http://localhost:*`

4. **Save Changes**
   - Click "Save" to apply restrictions
   - The token will only work on the specified URLs

## Token Usage

The token is used for:
- Displaying interactive maps with opportunity locations
- Geocoding addresses (server-side in `supabase/functions/import-hospitals`)

## Environment Variables

### Development
```env
VITE_MAPBOX_PUBLIC_TOKEN=pk.your_token_here
```

### Production
- Set in Lovable project settings
- Ensure URL restrictions are configured in Mapbox dashboard

## Monitoring

- Monitor Mapbox usage in the dashboard regularly
- Set up billing alerts to detect unexpected usage
- Review token usage logs if available

## Best Practices

1. ✅ **DO**: Use public tokens for client-side code
2. ✅ **DO**: Configure URL restrictions immediately
3. ✅ **DO**: Monitor usage regularly
4. ❌ **DON'T**: Share tokens publicly without restrictions
5. ❌ **DON'T**: Use secret tokens in client-side code

## Verification

To verify URL restrictions are working:
1. Try using the token on a different domain - it should fail
2. Check Mapbox dashboard for token usage patterns
3. Verify token only works on your specified domains

## Related Files

- `src/components/OpportunityMap.tsx` - Client-side map component
- `supabase/functions/import-hospitals/index.ts` - Server-side geocoding
- `.env` or Lovable environment variables - Token storage

## Support

If you encounter issues:
1. Check Mapbox dashboard for token status
2. Verify URL restrictions are correctly configured
3. Review Mapbox documentation: https://docs.mapbox.com/help/troubleshooting/

