# Supabase Password Policy Configuration

## Issue
The application requires minimal password requirements (1 character minimum, no special character or number requirements), but Supabase may have default password policies configured that enforce stricter requirements.

## Solution

Password policies in Supabase are configured in the **Supabase Dashboard**, not in code. To set minimal password requirements:

### Steps to Configure:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Policies** or **Authentication** → **Settings**
4. Look for **Password Requirements** or **Password Policy** settings
5. Configure the following:
   - **Minimum Password Length**: Set to `1` (minimum allowed)
   - **Require Special Characters**: Disable/Uncheck
   - **Require Numbers**: Disable/Uncheck
   - **Require Uppercase**: Disable/Uncheck (if available)
   - **Require Lowercase**: Disable/Uncheck (if available)

### Alternative: Using Supabase CLI (if available)

If your Supabase instance supports it, you can also configure password policies via the Management API or CLI, but the dashboard method is the most reliable.

### Verification

After updating the password policy:
1. Try creating an account with a simple password (e.g., "a")
2. The improved error handling in `src/pages/Auth.tsx` will now show the actual Supabase error message if there are still issues
3. Check the browser console for detailed error logs

## Current Code Configuration

The frontend code already has minimal validation:
- `src/pages/Auth.tsx`: Password validation is `.min(1)` (minimum 1 character)
- `src/lib/inputValidation.ts`: `validatePasswordStrength()` requires minimum 1 character
- `supabase/functions/reset-password/index.ts`: Password validation requires minimum 1 character

All code-level validations are set to minimum requirements. The only remaining configuration is in the Supabase Dashboard.

