import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Loader2, CheckCircle, XCircle, ShieldX } from "lucide-react";
import { logger } from "@/lib/logger";
import { logAdminAction } from "@/lib/auditLogger";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuth } from "@/hooks/useAuth";

interface DuplicateGroup {
  name: string;
  location: string;
  keep: string;
  remove: string[];
}

export default function AdminRemoveDuplicates() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { user, loading: authLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    success: boolean;
    removed: number;
    duplicateGroups: number;
    error?: string;
  } | null>(null);

  // Redirect if not admin
  if (!authLoading && !adminLoading && (!user || !isAdmin)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 pt-28 pb-8">
          <Card className="max-w-2xl mx-auto mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldX className="h-5 w-5 text-destructive" />
                Access Denied
              </CardTitle>
              <CardDescription>
                You must be an administrator to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const handleRemoveDuplicates = async () => {
    setIsProcessing(true);
    setProgress(10);
    setResults(null);

    try {
      setProgress(30);
      toast.info("Finding and removing duplicates...");

      const { data, error } = await supabase.functions.invoke('remove-duplicates', {
        body: {},
      });

      setProgress(100);

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setResults({
        success: true,
        removed: data?.removed || 0,
        duplicateGroups: data?.duplicateGroups || 0,
      });

      logAdminAction("remove_duplicates", {
        removed: data?.removed || 0,
        duplicateGroups: data?.duplicateGroups || 0,
      });

      toast.success(`Successfully removed ${data?.removed || 0} duplicate records!`);
      
      // Refresh page after 2 seconds to show updated count
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      logger.error("Remove duplicates error", error);
      toast.error("Failed to remove duplicates. Please try again.");
      setResults({
        success: false,
        removed: 0,
        duplicateGroups: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Remove Duplicates - Admin | ClinicalHours</title>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 pt-28 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 text-foreground">Remove Duplicate Hospitals</h1>
              <p className="text-muted-foreground">
                Find and remove duplicate hospital records from the database.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Duplicate Removal</CardTitle>
                <CardDescription>
                  This will find hospitals with the same name and location, keeping the oldest record and removing duplicates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground">Processing...</p>
                  </div>
                )}

                {results && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {results.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="font-semibold">
                        {results.success ? "Success" : "Error"}
                      </span>
                    </div>

                    {results.success && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Removed</p>
                          <p className="text-2xl font-bold">{results.removed}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Duplicate Groups</p>
                          <p className="text-2xl font-bold">{results.duplicateGroups}</p>
                        </div>
                      </div>
                    )}

                    {results.error && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-sm text-destructive">{results.error}</p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleRemoveDuplicates}
                  disabled={isProcessing || (adminLoading || authLoading)}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove Duplicates
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

