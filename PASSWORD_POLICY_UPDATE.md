# Update Supabase Password Policy to 6 Characters

The password validation error "password must be at least 12 characters" is coming from Supabase's server-side password policy, which needs to be updated in the Supabase Dashboard.

## Steps to Update Password Policy:

1. **Navigate to Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your project: `sysbtcikrbrrgafffody`

2. **Access Authentication Settings:**
   - In the left sidebar, click on **Authentication**
   - Click on **Policies** or **Settings** (depending on your Supabase version)

3. **Update Password Policy:**
   - Look for **Password Policy** or **Password Requirements** section
   - Find the **Minimum Password Length** setting
   - Change it from **12** to **6**
   - **Disable** any complexity requirements (uppercase, lowercase, numbers, special characters) if they are enabled
   - Save the changes

4. **Alternative Path (if above doesn't work):**
   - Go to **Authentication** → **Settings** → **Password**
   - Update the minimum length to 6
   - Disable complexity requirements

## Note:
- The client-side code has already been updated to require only 6+ characters
- The server-side Supabase policy must match the client-side validation
- After updating the dashboard settings, the error should be resolved

## Verification:
After updating the settings, try creating a new account with a 6-character password to verify the change is working.

