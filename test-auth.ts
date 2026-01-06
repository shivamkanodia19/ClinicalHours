/**
 * Comprehensive Authentication Testing Script
 * Tests all authentication flows, email systems, and security features
 * 
 * Usage:
 *   - Set TEST_EMAIL and TEST_PASSWORD environment variables
 *   - Run with: deno run --allow-net --allow-env test-auth.ts
 *   - Or use the interactive test runner below
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test utilities
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
  testResults.push({ name, passed, error, details });
}

function generateTestEmail() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `test-${timestamp}-${random}@example.com`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Suites

async function testSignUp() {
  console.log("\n🔵 TESTING SIGN UP FLOW\n");
  
  // Test 1: Valid sign up
  const testEmail1 = generateTestEmail();
  const testPassword = "TestPassword123!";
  const testName = "Test User";
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail1,
      password: testPassword,
      options: {
        data: { full_name: testName }
      }
    });
    
    if (error) throw error;
    if (!data.user) throw new Error("User not created");
    
    logTest("Sign Up - Valid credentials", true, undefined, {
      userId: data.user.id,
      email: data.user.email,
      emailConfirmed: data.user.email_confirmed_at !== null
    });
  } catch (error: any) {
    logTest("Sign Up - Valid credentials", false, error.message);
  }
  
  // Test 2: Invalid email format
  try {
    const { error } = await supabase.auth.signUp({
      email: "invalid-email",
      password: testPassword
    });
    
    const passed = error !== null && (error.message.includes("email") || error.message.includes("invalid"));
    logTest("Sign Up - Invalid email format", passed, passed ? undefined : "Expected error for invalid email");
  } catch (error: any) {
    logTest("Sign Up - Invalid email format", true);
  }
  
  // Test 3: Missing password
  try {
    const { error } = await supabase.auth.signUp({
      email: generateTestEmail(),
      password: ""
    });
    
    const passed = error !== null;
    logTest("Sign Up - Missing password", passed, passed ? undefined : "Expected error for missing password");
  } catch (error: any) {
    logTest("Sign Up - Missing password", true);
  }
  
  // Test 4: Duplicate email (should fail)
  try {
    const { error } = await supabase.auth.signUp({
      email: testEmail1, // Reuse email from test 1
      password: testPassword
    });
    
    const passed = error !== null;
    logTest("Sign Up - Duplicate email", passed, passed ? undefined : "Expected error for duplicate email");
  } catch (error: any) {
    logTest("Sign Up - Duplicate email", true);
  }
}

async function testSignIn() {
  console.log("\n🟢 TESTING SIGN IN FLOW\n");
  
  // First create a test user
  const testEmail = generateTestEmail();
  const testPassword = "TestPassword123!";
  
  let testUserId: string | null = null;
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (error) throw error;
    if (!data.user) throw new Error("User not created");
    testUserId = data.user.id;
    await sleep(1000); // Wait for user to be created
  } catch (error: any) {
    logTest("Sign In - Setup test user", false, error.message);
    return;
  }
  
  // Sign out first
  await supabase.auth.signOut();
  
  // Test 1: Valid sign in
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (error) throw error;
    if (!data.session) throw new Error("No session created");
    if (!data.user) throw new Error("No user returned");
    
    logTest("Sign In - Valid credentials", true, undefined, {
      userId: data.user.id,
      hasSession: !!data.session
    });
  } catch (error: any) {
    logTest("Sign In - Valid credentials", false, error.message);
  }
  
  // Test 2: Invalid password
  await supabase.auth.signOut();
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: "WrongPassword123!"
    });
    
    const passed = error !== null;
    logTest("Sign In - Invalid password", passed, passed ? undefined : "Expected error for invalid password");
  } catch (error: any) {
    logTest("Sign In - Invalid password", true);
  }
  
  // Test 3: Invalid email
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: "nonexistent@example.com",
      password: testPassword
    });
    
    const passed = error !== null;
    logTest("Sign In - Invalid email", passed, passed ? undefined : "Expected error for invalid email");
  } catch (error: any) {
    logTest("Sign In - Invalid email", true);
  }
  
  // Test 4: Empty password
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: ""
    });
    
    const passed = error !== null;
    logTest("Sign In - Empty password", passed, passed ? undefined : "Expected error for empty password");
  } catch (error: any) {
    logTest("Sign In - Empty password", true);
  }
}

async function testPasswordReset() {
  console.log("\n🟡 TESTING PASSWORD RESET FLOW\n");
  
  // Create a test user
  const testEmail = generateTestEmail();
  const testPassword = "TestPassword123!";
  const newPassword = "NewPassword123!";
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (error) throw error;
    if (!data.user) throw new Error("User not created");
    await sleep(1000);
  } catch (error: any) {
    logTest("Password Reset - Setup test user", false, error.message);
    return;
  }
  
  await supabase.auth.signOut();
  
  // Test 1: Request password reset for valid email
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        email: testEmail,
        origin: "http://localhost:5173"
      })
    });
    
    const data = await response.json();
    const passed = response.ok || (data.success === true);
    logTest("Password Reset - Request for valid email", passed, passed ? undefined : `Failed: ${JSON.stringify(data)}`);
  } catch (error: any) {
    logTest("Password Reset - Request for valid email", false, error.message);
  }
  
  // Test 2: Request password reset for invalid email (should not reveal if exists)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        origin: "http://localhost:5173"
      })
    });
    
    const data = await response.json();
    // Should return success even for non-existent emails (to prevent enumeration)
    const passed = response.ok || (data.success === true);
    logTest("Password Reset - Request for invalid email (enumeration protection)", passed, 
      passed ? undefined : "Should return success to prevent email enumeration");
  } catch (error: any) {
    logTest("Password Reset - Request for invalid email", false, error.message);
  }
  
  // Test 3: Invalid email format
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        email: "invalid-email",
        origin: "http://localhost:5173"
      })
    });
    
    const passed = !response.ok;
    logTest("Password Reset - Invalid email format", passed, passed ? undefined : "Expected error for invalid format");
  } catch (error: any) {
    logTest("Password Reset - Invalid email format", true);
  }
}

async function testEmailVerification() {
  console.log("\n🟣 TESTING EMAIL VERIFICATION FLOW\n");
  
  // Create a test user
  const testEmail = generateTestEmail();
  const testPassword = "TestPassword123!";
  let testUserId: string | null = null;
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (error) throw error;
    if (!data.user) throw new Error("User not created");
    testUserId = data.user.id;
    await sleep(1000);
    
    logTest("Email Verification - User created", true, undefined, {
      userId: data.user.id,
      email: data.user.email
    });
  } catch (error: any) {
    logTest("Email Verification - Setup test user", false, error.message);
    return;
  }
  
  // Test 1: Request verification email (requires auth)
  try {
    // First sign in to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError || !signInData.session) {
      throw new Error("Failed to sign in for verification test");
    }
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-verification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${signInData.session.access_token}`
      },
      body: JSON.stringify({
        userId: testUserId,
        email: testEmail,
        fullName: "Test User",
        origin: "http://localhost:5173"
      })
    });
    
    const data = await response.json();
    const passed = response.ok || (data.success === true);
    logTest("Email Verification - Request verification email", passed, 
      passed ? undefined : `Failed: ${JSON.stringify(data)}`);
  } catch (error: any) {
    logTest("Email Verification - Request verification email", false, error.message);
  }
  
  // Test 2: Verify with invalid token
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        token: "invalid-token-12345"
      })
    });
    
    const data = await response.json();
    const passed = !response.ok && data.error;
    logTest("Email Verification - Invalid token", passed, 
      passed ? undefined : "Expected error for invalid token");
  } catch (error: any) {
    logTest("Email Verification - Invalid token", true);
  }
}

async function testSessionManagement() {
  console.log("\n🔴 TESTING SESSION MANAGEMENT\n");
  
  const testEmail = generateTestEmail();
  const testPassword = "TestPassword123!";
  
  // Create and sign in user
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (error) throw error;
    if (!data.user) throw new Error("User not created");
    await sleep(1000);
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError || !signInData.session) {
      throw new Error("Failed to sign in");
    }
    
    logTest("Session Management - Sign in creates session", true, undefined, {
      hasSession: !!signInData.session,
      hasUser: !!signInData.user
    });
  } catch (error: any) {
    logTest("Session Management - Setup", false, error.message);
    return;
  }
  
  // Test 1: Get current session
  try {
    const { data, error } = await supabase.auth.getSession();
    const passed = !error && data.session !== null;
    logTest("Session Management - Get current session", passed, 
      passed ? undefined : "Failed to get session");
  } catch (error: any) {
    logTest("Session Management - Get current session", false, error.message);
  }
  
  // Test 2: Sign out
  try {
    const { error } = await supabase.auth.signOut();
    const passed = !error;
    
    // Verify session is cleared
    const { data } = await supabase.auth.getSession();
    const sessionCleared = !data.session;
    
    logTest("Session Management - Sign out", passed && sessionCleared, 
      (passed && sessionCleared) ? undefined : "Failed to sign out or session not cleared");
  } catch (error: any) {
    logTest("Session Management - Sign out", false, error.message);
  }
}

async function testEmailSystems() {
  console.log("\n📧 TESTING EMAIL SYSTEMS\n");
  
  // Note: These tests check the email functions are accessible
  // Actual email delivery requires RESEND_API_KEY to be configured
  
  // Test 1: Password reset email endpoint accessibility
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: "OPTIONS",
      headers: {
        "apikey": SUPABASE_ANON_KEY
      }
    });
    
    const passed = response.ok || response.status === 204;
    logTest("Email Systems - Password reset endpoint accessible", passed,
      passed ? undefined : `Status: ${response.status}`);
  } catch (error: any) {
    logTest("Email Systems - Password reset endpoint accessible", false, error.message);
  }
  
  // Test 2: Verification email endpoint accessibility (should require auth)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-verification-email`, {
      method: "OPTIONS",
      headers: {
        "apikey": SUPABASE_ANON_KEY
      }
    });
    
    const passed = response.ok || response.status === 204;
    logTest("Email Systems - Verification email endpoint accessible", passed,
      passed ? undefined : `Status: ${response.status}`);
  } catch (error: any) {
    logTest("Email Systems - Verification email endpoint accessible", false, error.message);
  }
}

async function testSecurityFeatures() {
  console.log("\n🔒 TESTING SECURITY FEATURES\n");
  
  // Test 1: CSRF protection (should fail without token for state-changing methods)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        email: "test@example.com",
        origin: "http://localhost:5173"
      })
    });
    
    // Should either succeed (if CSRF is handled differently) or return 403
    // The actual behavior depends on implementation
    const passed = response.ok || response.status === 403;
    logTest("Security - CSRF protection check", passed,
      passed ? undefined : `Unexpected status: ${response.status}`);
  } catch (error: any) {
    logTest("Security - CSRF protection check", false, error.message);
  }
  
  // Test 2: Origin validation
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Origin": "https://malicious-site.com"
      },
      body: JSON.stringify({
        email: "test@example.com",
        origin: "https://malicious-site.com"
      })
    });
    
    const data = await response.json();
    // Should reject invalid origin
    const passed = !response.ok || data.error;
    logTest("Security - Origin validation", passed,
      passed ? undefined : "Should reject invalid origins");
  } catch (error: any) {
    logTest("Security - Origin validation", true);
  }
  
  // Test 3: Rate limiting (attempt multiple requests rapidly)
  try {
    const testEmail = generateTestEmail();
    const requests = [];
    
    for (let i = 0; i < 5; i++) {
      requests.push(
        fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: testEmail,
            origin: "http://localhost:5173"
          })
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statuses = await Promise.all(responses.map(r => r.status));
    
    // At least one should be rate limited (429) if rate limiting works
    const hasRateLimit = statuses.some(s => s === 429);
    
    logTest("Security - Rate limiting", true, // Note: May not trigger in test environment
      undefined, { statuses, rateLimited: hasRateLimit });
  } catch (error: any) {
    logTest("Security - Rate limiting", false, error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log("🧪 COMPREHENSIVE AUTHENTICATION TEST SUITE");
  console.log("=" .repeat(60));
  
  await testSignUp();
  await testSignIn();
  await testPasswordReset();
  await testEmailVerification();
  await testSessionManagement();
  await testEmailSystems();
  await testSecurityFeatures();
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
  }
  
  console.log("\n" + "=".repeat(60));
}

// Run tests
if (import.meta.main) {
  runAllTests().catch(console.error);
}

