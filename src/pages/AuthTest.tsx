/**
 * Interactive Authentication Testing Page
 * 
 * This page provides an interactive interface to test authentication flows
 * without manually navigating through the app.
 * 
 * Access at: /auth-test (add route in App.tsx)
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  message?: string;
  details?: any;
}

export default function AuthTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [testEmail, setTestEmail] = useState(`test-${Date.now()}@example.com`);
  const [testPassword, setTestPassword] = useState("TestPassword123!");
  const [testName, setTestName] = useState("Test User");

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const updateResult = (name: string, updates: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, ...updates } : r));
  };

  const generateEmail = () => {
    setTestEmail(`test-${Date.now()}@example.com`);
  };

  // Test: Sign Up
  const testSignUp = async () => {
    addResult({ name: "Sign Up", status: "running" });
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: { full_name: testName }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error("User not created");

      updateResult("Sign Up", {
        status: "passed",
        message: "Account created successfully",
        details: {
          userId: data.user.id,
          email: data.user.email,
          emailConfirmed: !!data.user.email_confirmed_at
        }
      });
      toast.success("Sign up successful!");
    } catch (error: any) {
      updateResult("Sign Up", {
        status: "failed",
        message: error.message || "Sign up failed"
      });
      toast.error("Sign up failed: " + error.message);
    }
  };

  // Test: Sign In
  const testSignIn = async () => {
    addResult({ name: "Sign In", status: "running" });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (error) throw error;
      if (!data.session) throw new Error("No session created");

      updateResult("Sign In", {
        status: "passed",
        message: "Signed in successfully",
        details: {
          userId: data.user?.id,
          hasSession: !!data.session
        }
      });
      toast.success("Sign in successful!");
    } catch (error: any) {
      updateResult("Sign In", {
        status: "failed",
        message: error.message || "Sign in failed"
      });
      toast.error("Sign in failed: " + error.message);
    }
  };

  // Test: Get Session
  const testGetSession = async () => {
    addResult({ name: "Get Session", status: "running" });
    
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      updateResult("Get Session", {
        status: data.session ? "passed" : "failed",
        message: data.session ? "Session found" : "No active session",
        details: {
          hasSession: !!data.session,
          userId: data.session?.user?.id
        }
      });
    } catch (error: any) {
      updateResult("Get Session", {
        status: "failed",
        message: error.message || "Failed to get session"
      });
    }
  };

  // Test: Sign Out
  const testSignOut = async () => {
    addResult({ name: "Sign Out", status: "running" });
    
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      // Verify session is cleared
      const { data } = await supabase.auth.getSession();
      
      updateResult("Sign Out", {
        status: !data.session ? "passed" : "failed",
        message: !data.session ? "Signed out successfully" : "Session not cleared",
      });
      toast.success("Signed out!");
    } catch (error: any) {
      updateResult("Sign Out", {
        status: "failed",
        message: error.message || "Sign out failed"
      });
    }
  };

  // Test: Request Password Reset
  const testRequestPasswordReset = async () => {
    addResult({ name: "Request Password Reset", status: "running" });
    
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          email: testEmail,
          origin: window.location.origin
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateResult("Request Password Reset", {
        status: "passed",
        message: "Reset email sent (or would be sent if email exists)",
        details: data
      });
      toast.success("Password reset requested!");
    } catch (error: any) {
      updateResult("Request Password Reset", {
        status: "failed",
        message: error.message || "Failed to request password reset"
      });
      toast.error("Password reset failed: " + error.message);
    }
  };

  // Test: Send Verification Email
  const testSendVerificationEmail = async () => {
    addResult({ name: "Send Verification Email", status: "running" });
    
    try {
      // Need to be signed in first
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Must be signed in to send verification email");
      }

      const { data, error } = await supabase.functions.invoke("send-verification-email", {
        body: {
          userId: session.session.user.id,
          email: testEmail,
          fullName: testName,
          origin: window.location.origin
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateResult("Send Verification Email", {
        status: "passed",
        message: "Verification email sent",
        details: data
      });
      toast.success("Verification email sent!");
    } catch (error: any) {
      updateResult("Send Verification Email", {
        status: "failed",
        message: error.message || "Failed to send verification email"
      });
      toast.error("Failed: " + error.message);
    }
  };

  // Test: Verify Email (requires token)
  const testVerifyEmail = async (token: string) => {
    addResult({ name: "Verify Email", status: "running" });
    
    try {
      const { data, error } = await supabase.functions.invoke("verify-email", {
        body: { token }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateResult("Verify Email", {
        status: "passed",
        message: "Email verified successfully",
        details: data
      });
      toast.success("Email verified!");
    } catch (error: any) {
      updateResult("Verify Email", {
        status: "failed",
        message: error.message || "Failed to verify email"
      });
      toast.error("Verification failed: " + error.message);
    }
  };

  // Run All Tests
  const runAllTests = async () => {
    setResults([]);
    setRunning(true);

    try {
      // 1. Sign Up
      await testSignUp();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2. Get Session
      await testGetSession();
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Sign Out
      await testSignOut();
      await new Promise(resolve => setTimeout(resolve, 500));

      // 4. Sign In
      await testSignIn();
      await new Promise(resolve => setTimeout(resolve, 500));

      // 5. Request Password Reset
      await testRequestPasswordReset();
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. Send Verification Email (if signed in)
      await testSendVerificationEmail();
      
      toast.success("All tests completed!");
    } catch (error) {
      toast.error("Test suite error: " + (error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Testing Suite</CardTitle>
          <CardDescription>
            Interactive testing interface for authentication flows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="tests">Individual Tests</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-email">Test Email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com"
                    />
                    <Button variant="outline" onClick={generateEmail}>
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-password">Test Password</Label>
                  <Input
                    id="test-password"
                    type="password"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="Password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-name">Test Name</Label>
                  <Input
                    id="test-name"
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Full Name"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={runAllTests} disabled={running}>
                    {running ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Tests...
                      </>
                    ) : (
                      "Run All Tests"
                    )}
                  </Button>
                  <Button variant="outline" onClick={clearResults}>
                    Clear Results
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tests" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={testSignUp} disabled={running} variant="outline">
                  Test Sign Up
                </Button>
                <Button onClick={testSignIn} disabled={running} variant="outline">
                  Test Sign In
                </Button>
                <Button onClick={testGetSession} disabled={running} variant="outline">
                  Test Get Session
                </Button>
                <Button onClick={testSignOut} disabled={running} variant="outline">
                  Test Sign Out
                </Button>
                <Button onClick={testRequestPasswordReset} disabled={running} variant="outline">
                  Test Password Reset Request
                </Button>
                <Button onClick={testSendVerificationEmail} disabled={running} variant="outline">
                  Test Send Verification Email
                </Button>
              </div>

              <div className="pt-4 space-y-2">
                <Label>Verify Email (requires token from email)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Verification token"
                    id="verify-token"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const token = (e.target as HTMLInputElement).value;
                        if (token) {
                          testVerifyEmail(token);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById("verify-token") as HTMLInputElement;
                      if (input?.value) {
                        testVerifyEmail(input.value);
                        input.value = "";
                      }
                    }}
                  >
                    Verify
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {results.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No test results yet. Run some tests to see results here.
                </p>
              ) : (
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <div>
                              <p className="font-medium">{result.name}</p>
                              {result.message && (
                                <p className="text-sm text-muted-foreground">
                                  {result.message}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            result.status === "passed" ? "bg-green-100 text-green-700" :
                            result.status === "failed" ? "bg-red-100 text-red-700" :
                            result.status === "running" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {result.status}
                          </span>
                        </div>
                        {result.details && (
                          <details className="mt-2">
                            <summary className="text-sm cursor-pointer text-muted-foreground">
                              View Details
                            </summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Passed: {results.filter(r => r.status === "passed").length} / {" "}
                    Failed: {results.filter(r => r.status === "failed").length} / {" "}
                    Total: {results.length}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

