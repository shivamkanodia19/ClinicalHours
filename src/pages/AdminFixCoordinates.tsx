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
import { MapPin, Loader2, CheckCircle, XCircle, ShieldX } from "lucide-react";
import { logger } from "@/lib/logger";
import { logAdminAction } from "@/lib/auditLogger";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuth } from "@/hooks/useAuth";

export default function AdminFixCoordinates() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { user, loading: authLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    success: boolean;
    geocoded: number;
    failed: number;
    remaining: number;
    processed: number;
    error?: string;
  } | null>(null);
  const [opportunityIds, setOpportunityIds] = useState<string[]>([]);

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

  const findMissingCoordinates = async () => {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, name, location, latitude, longitude')
        .order('name');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No opportunities found");
        return;
      }

      // Find opportunities missing coordinates or with invalid coordinates
      const needsGeocoding = data.filter(opp => {
        const lat = opp.latitude;
        const lon = opp.longitude;
        const isValid = lat !== null && lon !== null && 
                       !isNaN(lat) && !isNaN(lon) &&
                       lat >= 24 && lat <= 50 &&
                       lon >= -130 && lon <= -65;
        return !isValid;
      });

      setOpportunityIds(needsGeocoding.map(opp => opp.id));
      toast.info(`Found ${needsGeocoding.length} hospitals needing coordinates`);
    } catch (error) {
      logger.error("Error finding missing coordinates", error);
      toast.error("Failed to find hospitals with missing coordinates");
    }
  };

  const handleFixCoordinates = async () => {
    if (opportunityIds.length === 0) {
      await findMissingCoordinates();
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      const BATCH_SIZE = 10;
      let totalGeocoded = 0;
      let totalFailed = 0;
      let remaining = opportunityIds.length;

      for (let i = 0; i < opportunityIds.length; i += BATCH_SIZE) {
        const batch = opportunityIds.slice(i, i + BATCH_SIZE);
        const progressPercent = ((i + batch.length) / opportunityIds.length * 100);
        setProgress(progressPercent);

        const { data, error } = await supabase.functions.invoke('fix-coordinates', {
          body: {
            opportunityIds: batch,
            batchSize: batch.length,
          },
        });

        if (error) {
          console.error('Batch error:', error);
          totalFailed += batch.length;
          continue;
        }

        if (data?.error) {
          console.error('Error:', data.error);
          totalFailed += batch.length;
          continue;
        }

        totalGeocoded += data?.geocoded || 0;
        totalFailed += data?.failed || 0;
        remaining = data?.remaining || remaining - (data?.geocoded || 0);

        // Rate limiting
        if (i + BATCH_SIZE < opportunityIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress(100);
      setResults({
        success: true,
        geocoded: totalGeocoded,
        failed: totalFailed,
        remaining,
        processed: opportunityIds.length,
      });

      logAdminAction("fix_coordinates", {
        geocoded: totalGeocoded,
        failed: totalFailed,
        remaining,
      });

      toast.success(`Geocoded ${totalGeocoded} hospitals!`);
      
      // Update the list of IDs that still need geocoding
      if (remaining > 0) {
        // Re-fetch to get updated list
        const { data: updatedData } = await supabase
          .from('opportunities')
          .select('id, latitude, longitude')
          .order('name');
        
        if (updatedData) {
          const stillNeedsGeocoding = updatedData.filter(opp => {
            const lat = opp.latitude;
            const lon = opp.longitude;
            const isValid = lat !== null && lon !== null && 
                           !isNaN(lat) && !isNaN(lon) &&
                           lat >= 24 && lat <= 50 &&
                           lon >= -130 && lon <= -65;
            return !isValid;
          });
          setOpportunityIds(stillNeedsGeocoding.map(opp => opp.id));
        }
      } else {
        setOpportunityIds([]);
      }
    } catch (error) {
      logger.error("Fix coordinates error", error);
      toast.error("Failed to fix coordinates. Please try again.");
      setResults({
        success: false,
        geocoded: 0,
        failed: 0,
        remaining: 0,
        processed: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Fix Map Coordinates - Admin | ClinicalHours</title>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 pt-28 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 text-foreground">Fix Map Coordinates</h1>
              <p className="text-muted-foreground">
                Geocode hospitals that are missing coordinates or have invalid coordinates.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Coordinate Fixing</CardTitle>
                <CardDescription>
                  This will find hospitals without valid coordinates and geocode them using Mapbox.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {opportunityIds.length > 0 && (
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm">
                      Found <strong>{opportunityIds.length}</strong> hospitals needing coordinates
                    </p>
                  </div>
                )}

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground">
                      Processing... {Math.round(progress)}%
                    </p>
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
                          <p className="text-sm text-muted-foreground">Geocoded</p>
                          <p className="text-2xl font-bold text-green-500">{results.geocoded}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Failed</p>
                          <p className="text-2xl font-bold text-destructive">{results.failed}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Remaining</p>
                          <p className="text-2xl font-bold">{results.remaining}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Processed</p>
                          <p className="text-2xl font-bold">{results.processed}</p>
                        </div>
                      </div>
                    )}

                    {results.error && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-sm text-destructive">{results.error}</p>
                      </div>
                    )}

                    {results.success && results.remaining > 0 && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                        <p className="text-sm">
                          {results.remaining} hospitals still need coordinates. Click the button again to process more.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={findMissingCoordinates}
                    disabled={isProcessing || (adminLoading || authLoading)}
                    variant="outline"
                  >
                    Find Missing Coordinates
                  </Button>
                  <Button
                    onClick={handleFixCoordinates}
                    disabled={isProcessing || (adminLoading || authLoading)}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-4 w-4" />
                        {opportunityIds.length > 0 ? `Fix ${opportunityIds.length} Hospitals` : 'Fix Coordinates'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

