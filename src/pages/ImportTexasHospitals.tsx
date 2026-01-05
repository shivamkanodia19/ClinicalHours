import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, CheckCircle2, XCircle, FileText } from "lucide-react";

interface ImportResult {
  success: boolean;
  message?: string;
  imported?: number;
  duplicates?: number;
  errors?: string[];
  error?: string;
}

const ImportTexasHospitals = () => {
  const { user, loading: authLoading, isReady } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (authLoading || roleLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 pt-28 pb-8 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You need administrator privileges to access this page.
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Find column indices
    const getIndex = (patterns: string[]) => {
      return headers.findIndex(h => 
        patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
      );
    };
    
    const nameIdx = getIndex(['tags/name', 'name']);
    const cityIdx = getIndex(['tags/addr:city', 'addr:city']);
    const stateIdx = getIndex(['tags/addr:state', 'addr:state']);
    const streetIdx = getIndex(['tags/addr:street', 'addr:street']);
    const housenumberIdx = getIndex(['tags/addr:housenumber', 'addr:housenumber']);
    const postcodeIdx = getIndex(['tags/addr:postcode', 'addr:postcode']);
    const latIdx = getIndex(['lat', 'center/lat']);
    const lonIdx = getIndex(['lon', 'center/lon']);
    const phoneIdx = getIndex(['tags/phone', 'phone']);
    const websiteIdx = getIndex(['tags/website', 'website']);
    const emailIdx = getIndex(['tags/email', 'email']);
    const descIdx = getIndex(['tags/description', 'description']);
    const bedsIdx = getIndex(['tags/beds', 'beds']);
    const emergencyIdx = getIndex(['tags/emergency', 'emergency']);
    const specialtyIdx = getIndex(['tags/healthcare:speciality', 'healthcare:speciality']);
    
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle CSV with potential commas in quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const name = nameIdx >= 0 ? values[nameIdx] : '';
      if (!name) continue;
      
      // Parse lat/lon - try center/lat first, then lat
      let lat = 0;
      let lon = 0;
      
      // Check for center/lat and center/lon columns
      const centerLatIdx = headers.findIndex(h => h === 'center/lat');
      const centerLonIdx = headers.findIndex(h => h === 'center/lon');
      
      if (centerLatIdx >= 0 && values[centerLatIdx]) {
        lat = parseFloat(values[centerLatIdx]) || 0;
      } else if (latIdx >= 0) {
        lat = parseFloat(values[latIdx]) || 0;
      }
      
      if (centerLonIdx >= 0 && values[centerLonIdx]) {
        lon = parseFloat(values[centerLonIdx]) || 0;
      } else if (lonIdx >= 0) {
        lon = parseFloat(values[lonIdx]) || 0;
      }
      
      records.push({
        name,
        city: cityIdx >= 0 ? values[cityIdx] || '' : '',
        state: stateIdx >= 0 ? values[stateIdx] || 'TX' : 'TX',
        street: streetIdx >= 0 ? values[streetIdx] || '' : '',
        housenumber: housenumberIdx >= 0 ? values[housenumberIdx] || '' : '',
        postcode: postcodeIdx >= 0 ? values[postcodeIdx] || '' : '',
        lat,
        lon,
        phone: phoneIdx >= 0 ? values[phoneIdx] || '' : '',
        website: websiteIdx >= 0 ? values[websiteIdx] || '' : '',
        email: emailIdx >= 0 ? values[emailIdx] || '' : '',
        description: descIdx >= 0 ? values[descIdx] || '' : '',
        beds: bedsIdx >= 0 ? values[bedsIdx] || '' : '',
        emergency: emergencyIdx >= 0 ? values[emergencyIdx] || '' : '',
        specialty: specialtyIdx >= 0 ? values[specialtyIdx] || '' : '',
      });
    }
    
    return records;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setResult(null);
    setProgress(0);
    setImporting(true);
    
    try {
      setProgress(10);
      
      // Read and parse CSV
      const text = await file.text();
      setProgress(30);
      
      const csvData = parseCSV(text);
      setProgress(50);
      
      if (csvData.length === 0) {
        throw new Error("No valid hospital records found in the CSV");
      }
      
      toast({
        title: "Processing",
        description: `Found ${csvData.length} records in CSV. Starting import...`,
      });
      
      setProgress(60);
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('import-texas-hospitals', {
        body: { csvData }
      });
      
      setProgress(90);
      
      if (error) {
        throw error;
      }
      
      setProgress(100);
      setResult(data as ImportResult);
      
      if (data?.success) {
        toast({
          title: "Import Complete!",
          description: data.message || `Imported ${data.imported || 0} hospitals`,
        });
      } else {
        toast({
          title: "Import Issue",
          description: data?.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Import error:", error);
      const message = error instanceof Error ? error.message : "Import failed";
      setResult({ success: false, error: message });
      toast({
        title: "Import Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 pt-28 pb-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Import Texas Hospitals</h1>
          <p className="text-muted-foreground mb-8">
            Upload a CSV file containing Texas hospital data to import into the database.
          </p>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Select a CSV file with hospital data. Duplicates will be automatically skipped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={importing}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="gap-2"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {importing ? "Importing..." : "Select CSV File"}
                  </Button>
                  {fileName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {fileName}
                    </div>
                  )}
                </div>
                
                {importing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground">
                      {progress < 30 && "Reading file..."}
                      {progress >= 30 && progress < 60 && "Parsing CSV data..."}
                      {progress >= 60 && progress < 90 && "Importing to database..."}
                      {progress >= 90 && "Finishing up..."}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {result && (
            <Card className={result.success ? "border-green-500/50" : "border-destructive/50"}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {result.success ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-8 w-8 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">
                      {result.success ? "Import Successful" : "Import Failed"}
                    </h3>
                    {result.success ? (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>✓ Imported: {result.imported || 0} hospitals</p>
                        <p>⊘ Skipped duplicates: {result.duplicates || 0}</p>
                        {result.errors && result.errors.length > 0 && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                            <p className="font-medium mb-1">Some errors occurred:</p>
                            {result.errors.map((err, i) => (
                              <p key={i}>{err}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-destructive">
                        {result.error || "An unknown error occurred"}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="mt-6 bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Expected CSV Format</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="mb-2">The CSV should include these columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>tags/name</code> - Hospital name (required)</li>
                <li><code>tags/addr:city</code> - City</li>
                <li><code>tags/addr:state</code> - State (defaults to TX)</li>
                <li><code>tags/addr:street</code> - Street address</li>
                <li><code>tags/addr:postcode</code> - ZIP code</li>
                <li><code>lat</code> / <code>center/lat</code> - Latitude</li>
                <li><code>lon</code> / <code>center/lon</code> - Longitude</li>
                <li><code>tags/phone</code> - Phone number</li>
                <li><code>tags/website</code> - Website URL</li>
                <li><code>tags/email</code> - Email address</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ImportTexasHospitals;
