import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { logAuthEvent } from "@/lib/auditLogger";
import { z } from "zod";
import { ArrowLeft, Stethoscope, Heart, Activity, Mail, RefreshCw } from "lucide-react";
import logo from "@/assets/logo.png";

// Password validation: min 10 characters, at least 2 of: uppercase, lowercase, digit, special character
const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string()
    .min(10, { message: "Password must be at least 10 characters long" })
    .max(128)
    .refine((password) => {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasDigit = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      const complexityCount = [hasUpperCase, hasLowerCase, hasDigit, hasSpecialChar].filter(Boolean).length;
      return complexityCount >= 2;
    }, { message: "Password must contain at least 2 of: uppercase letters, lowercase letters, numbers, or special characters" }),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100).optional(),
  phone: z.string().max(20).optional().or(z.literal("")),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [signedUpUserId, setSignedUpUserId] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const sendVerificationEmail = async (userId: string, userEmail: string, userName: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-verification-email", {
        body: {
          userId,
          email: userEmail,
          fullName: userName,
          origin: window.location.origin,
        },
      });

      if (error) {
        // Error logged silently - user will see toast message
        return false;
      }
      return true;
    } catch (error) {
      // Error logged silently - user will see toast message
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password, fullName, phone });
      
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: validatedData.fullName,
          },
        },
      });

      if (error) throw error;

      // Update phone number in profile if provided
      if (data.user && validatedData.phone) {
        await supabase
          .from("profiles")
          .update({ phone: validatedData.phone })
          .eq("id", data.user.id);
      }

      // Send custom verification email
      if (data.user) {
        logAuthEvent("signup", { email: validatedData.email });
        setSignedUpUserId(data.user.id);
        const emailSent = await sendVerificationEmail(
          data.user.id,
          validatedData.email,
          validatedData.fullName || "User"
        );

        if (emailSent) {
          setShowVerificationMessage(true);
          toast.success("Account created! Please check your email to verify your account.");
        } else {
          toast.success("Account created! You can now log in.");
        }
      }
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        // Generic error message to prevent email enumeration
        // Don't reveal if email exists or specific error details
        toast.error("Unable to create account. Please check your information and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!signedUpUserId || !email || !fullName) return;
    
    setResendLoading(true);
    try {
      const success = await sendVerificationEmail(signedUpUserId, email, fullName);
      if (success) {
        toast.success("Verification email sent! Please check your inbox.");
      } else {
        toast.error("Failed to send verification email. Please try again.");
      }
    } catch (error) {
      toast.error("Failed to send verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        logAuthEvent("login_failure", { email: validatedData.email });
        throw error;
      }

      logAuthEvent("login_success", { email: validatedData.email });
      toast.success("Logged in successfully!");
      navigate("/dashboard");
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        // Generic error message to prevent information disclosure and email enumeration
        // Don't reveal if email exists or specific error details
        toast.error("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email, origin: window.location.origin },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setResetEmailSent(true);
      toast.success("If an account exists, a password reset email will be sent.");
    } catch (error: unknown) {
      // Sanitize error message
      const errorMessage = error instanceof Error && (error.message?.includes("rate limit") || error.message?.includes("too many"))
        ? "Too many requests. Please wait a moment and try again."
        : "Failed to send reset email. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };


  // Show forgot password screen
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          {resetEmailSent ? (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h1>
                <p className="text-muted-foreground">
                  We've sent a password reset link to <strong className="text-foreground">{email}</strong>
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to reset your password. If you don't see it, check your spam folder.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Forgot Password?</h1>
                <p className="text-muted-foreground">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setShowForgotPassword(false);
              setResetEmailSent(false);
              setEmail("");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Show verification message screen
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h1>
            <p className="text-muted-foreground">
              We've sent a verification link to <strong className="text-foreground">{email}</strong>
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-left">
            <p className="text-sm text-muted-foreground mb-3">
              Click the link in the email to verify your account. If you don't see it, check your spam folder.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendVerification}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend Verification Email
                </>
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setShowVerificationMessage(false);
              setEmail("");
              setPassword("");
              setFullName("");
              setPhone("");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign Up
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent">
        {/* Decorative floating elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-20 h-20 rounded-full bg-background/10 animate-float" />
          <div className="absolute top-40 right-20 w-32 h-32 rounded-full bg-background/5 animate-float-slow" />
          <div className="absolute bottom-32 left-20 w-16 h-16 rounded-full bg-background/10 animate-float" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-20 right-10 w-24 h-24 rounded-full bg-background/5 animate-float-slow" style={{ animationDelay: "0.5s" }} />
          
          {/* Decorative icons */}
          <Stethoscope className="absolute top-1/4 right-1/4 w-12 h-12 text-background/20 animate-float" style={{ animationDelay: "0.3s" }} />
          <Heart className="absolute bottom-1/3 left-1/4 w-10 h-10 text-background/15 animate-float-slow" style={{ animationDelay: "0.7s" }} />
          <Activity className="absolute top-1/2 right-1/3 w-14 h-14 text-background/10 animate-float" style={{ animationDelay: "1.2s" }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <h1 className="text-4xl xl:text-5xl font-bold text-primary-foreground mb-6">
            <span>Clinical</span><span className="font-bold">Hours</span>
          </h1>
          <p className="text-xl xl:text-2xl text-primary-foreground/90 mb-4 font-medium">
            Find Your Path to Clinical Experience
          </p>
          <p className="text-primary-foreground/70 text-lg max-w-md">
            Discover, track, and connect with clinical volunteering opportunities across the nation. Your journey to medical school starts here.
          </p>
          
          {/* Stats or features */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>4750+ Clinical Opportunities</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>Nationwide Hospital Network</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>Track Your Applications</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>Community Reviews & Insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 bg-background">
        {/* Back to Home Link */}
        <Link 
          to="/" 
          className="absolute top-6 left-6 lg:left-auto lg:right-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Home</span>
        </Link>

        <div className="w-full max-w-md mx-auto">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <img src={logo} alt="ClinicalHours" className="h-16 w-auto mx-auto mb-4" />
            <p className="text-muted-foreground">
              Connect with clinical opportunities
            </p>
          </div>

          {/* Mobile branding banner */}
          <div className="lg:hidden mb-8 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-center text-primary font-medium">
              Your journey to medical school starts here
            </p>
          </div>

          {/* Auth Tabs */}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">
                    Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  By signing up, you agree to our{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms & Conditions
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
