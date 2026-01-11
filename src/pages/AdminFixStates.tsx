import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Check, AlertCircle, Search, Wrench, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OpportunityPreview {
  id: string;
  currentLocation: string;
  coordinates: { lat: number; lng: number };
}

interface FixResult {
  id: string;
  oldLocation: string;
  newLocation: string;
  status: string;
}

const MAPBOX_TOKEN = "pk.eyJ1IjoicmFnaGF2dDIwMDciLCJhIjoiY21oeTJzb2dvMDhsdDJ3cTZqMzVtc3Q4cCJ9.DXBjsf0TdbDT_KFXcc2mpg";

// Reverse geocode using Mapbox to get state from coordinates
async function getStateFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=region&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].text;
    }
    
    return null;
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return null;
  }
}

const AdminFixStates = () => {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [generatingSQL, setGeneratingSQL] = useState(false);
  const [opportunities, setOpportunities] = useState<OpportunityPreview[]>([]);
  const [fixResults, setFixResults] = useState<FixResult[]>([]);
  const [totalMissing, setTotalMissing] = useState(0);
  const { toast } = useToast();

  const handlePreview = async () => {
    setLoading(true);
    setOpportunities([]);
    setFixResults([]);

    try {
      // Fetch all opportunities
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, location, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (error) throw error;

      // Filter to only those missing a state (no comma in location)
      const missingState = (data || []).filter(
        (opp) => opp.location && !opp.location.includes(",")
      );

      setTotalMissing(missingState.length);
      setOpportunities(
        missingState.map((opp) => ({
          id: opp.id,
          currentLocation: opp.location,
          coordinates: { lat: opp.latitude!, lng: opp.longitude! },
        }))
      );

      toast({
        title: "Preview Complete",
        description: `Found ${missingState.length} opportunities missing state information.`,
      });
    } catch (error) {
      console.error("Error fetching preview:", error);
      toast({
        title: "Error",
        description: "Failed to fetch opportunities. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (opportunities.length === 0) {
      toast({
        title: "No opportunities to fix",
        description: "Run preview first to find opportunities missing states.",
        variant: "destructive",
      });
      return;
    }

    setFixing(true);
    const results: FixResult[] = [];
    let successCount = 0;
    let failCount = 0;

    try {
      // Process in batches to show progress
      for (const opp of opportunities) {
        // Get state from coordinates using Mapbox
        const state = await getStateFromCoordinates(
          opp.coordinates.lat,
          opp.coordinates.lng
        );

        if (state) {
          const newLocation = `${opp.currentLocation}, ${state}`;

          // Use RPC call to bypass RLS - call a database function
          const { error: updateError } = await supabase.rpc('admin_update_opportunity_location', {
            opp_id: opp.id,
            new_location: newLocation
          });

          if (updateError) {
            // Fallback to direct update (in case RPC doesn't exist)
            const { error: directError } = await supabase
              .from("opportunities")
              .update({ location: newLocation })
              .eq("id", opp.id);
            
            if (directError) {
              results.push({
                id: opp.id,
                oldLocation: opp.currentLocation,
                newLocation: opp.currentLocation,
                status: `failed - ${directError.message}`,
              });
              failCount++;
            } else {
              results.push({
                id: opp.id,
                oldLocation: opp.currentLocation,
                newLocation: newLocation,
                status: "fixed",
              });
              successCount++;
            }
          } else {
            results.push({
              id: opp.id,
              oldLocation: opp.currentLocation,
              newLocation: newLocation,
              status: "fixed",
            });
            successCount++;
          }
        } else {
          results.push({
            id: opp.id,
            oldLocation: opp.currentLocation,
            newLocation: opp.currentLocation,
            status: "failed - could not reverse geocode",
          });
          failCount++;
        }

        // Update results in real-time
        setFixResults([...results]);

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      toast({
        title: "Fix Complete",
        description: `Fixed ${successCount} of ${results.length} opportunities. ${failCount} failed.`,
      });
    } catch (error) {
      console.error("Error fixing:", error);
      toast({
        title: "Error",
        description: "An error occurred while fixing. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const handleGenerateSQL = async () => {
    if (opportunities.length === 0) {
      toast({
        title: "No opportunities to fix",
        description: "Run preview first to find opportunities missing states.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingSQL(true);
    const sqlStatements: string[] = [];
    sqlStatements.push("-- SQL script to fix missing states in opportunities table");
    sqlStatements.push("-- Generated by ClinicalHours Admin Tool");
    sqlStatements.push(`-- Date: ${new Date().toISOString()}`);
    sqlStatements.push(`-- Total entries to fix: ${opportunities.length}`);
    sqlStatements.push("");
    sqlStatements.push("BEGIN;");
    sqlStatements.push("");

    let processed = 0;
    let failed = 0;

    try {
      for (const opp of opportunities) {
        // Get state from coordinates using Mapbox
        const state = await getStateFromCoordinates(
          opp.coordinates.lat,
          opp.coordinates.lng
        );

        if (state) {
          const newLocation = `${opp.currentLocation}, ${state}`;
          // Escape single quotes in location names
          const escapedLocation = newLocation.replace(/'/g, "''");
          const escapedOldLocation = opp.currentLocation.replace(/'/g, "''");
          
          sqlStatements.push(`-- Fix: "${opp.currentLocation}" -> "${newLocation}"`);
          sqlStatements.push(`UPDATE opportunities SET location = '${escapedLocation}', updated_at = NOW() WHERE id = '${opp.id}';`);
          sqlStatements.push("");
          processed++;
        } else {
          sqlStatements.push(`-- FAILED to geocode: "${opp.currentLocation}" (id: ${opp.id})`);
          sqlStatements.push("");
          failed++;
        }

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      sqlStatements.push("COMMIT;");
      sqlStatements.push("");
      sqlStatements.push(`-- Summary: ${processed} updates, ${failed} failed to geocode`);

      // Create and download the file
      const blob = new Blob([sqlStatements.join("\n")], { type: "text/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fix-missing-states-${new Date().toISOString().split("T")[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "SQL File Generated",
        description: `Created SQL with ${processed} UPDATE statements. Send this file to Lovable support to run.`,
      });
    } catch (error) {
      console.error("Error generating SQL:", error);
      toast({
        title: "Error",
        description: "An error occurred while generating SQL.",
        variant: "destructive",
      });
    } finally {
      setGeneratingSQL(false);
    }
  };

  const fixedCount = fixResults.filter((r) => r.status === "fixed").length;
  const failedCount = fixResults.filter((r) => r.status !== "fixed").length;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Fix Missing States
          </h1>
          <p className="text-muted-foreground">
            This tool finds opportunities where the location is missing a state and uses
            reverse geocoding (via Mapbox) to add the state based on coordinates.
          </p>
        </div>

        {/* Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              First preview to see which opportunities need fixing, then apply the fix.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button onClick={handlePreview} disabled={loading || fixing}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Preview Missing States
            </Button>
            <Button
              onClick={handleFix}
              disabled={loading || fixing || opportunities.length === 0}
              variant="default"
            >
              {fixing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4 mr-2" />
              )}
              Fix All ({opportunities.length})
            </Button>
            <Button
              onClick={handleGenerateSQL}
              disabled={loading || fixing || generatingSQL || opportunities.length === 0}
              variant="outline"
            >
              {generatingSQL ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download SQL Fix
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        {(totalMissing > 0 || fixResults.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">{totalMissing}</div>
                  <div className="text-sm text-muted-foreground">Total Missing States</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{fixedCount}</div>
                  <div className="text-sm text-muted-foreground">Fixed</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{failedCount}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results */}
        {fixResults.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Fix Results</CardTitle>
              <CardDescription>
                Results of the state fixing operation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fixResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded-lg border ${
                      result.status === "fixed"
                        ? "bg-green-500/10 border-green-500/20"
                        : "bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.status === "fixed" ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium text-foreground truncate">
                            {result.oldLocation}
                          </span>
                        </div>
                        {result.status === "fixed" && (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>→</span>
                            <span className="text-green-500">{result.newLocation}</span>
                          </div>
                        )}
                        {result.status !== "fixed" && (
                          <div className="text-sm text-red-400">{result.status}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {opportunities.length > 0 && fixResults.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Opportunities Missing States</CardTitle>
              <CardDescription>
                Showing {opportunities.length} of {totalMissing} opportunities that need state information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3 rounded-lg border bg-card/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{opp.currentLocation}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {opp.coordinates.lat.toFixed(4)}, {opp.coordinates.lng.toFixed(4)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {opportunities.length === 0 && !loading && fixResults.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Preview Missing States" to find opportunities that need fixing.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminFixStates;

