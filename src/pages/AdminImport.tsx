import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface CSVRow {
  name: string;
  website: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  lat: string;
  lon: string;
  bio?: string;
}

function parseCSV(csvText: string, isOSMFormat: boolean = false): CSVRow[] {
  const lines = csvText.split('\n');
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
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
    
    const rawRow: Record<string, string> = {};
    headers.forEach((header, index) => {
      rawRow[header] = values[index] || '';
    });
    
    // Transform OSM format to standard format
    if (isOSMFormat) {
      const name = rawRow['elements__tags__name'] || '';
      if (!name) continue; // Skip rows without name
      
      const lat = rawRow['elements__lat'] || rawRow['elements__center__lat'] || '';
      const lon = rawRow['elements__lon'] || rawRow['elements__center__lon'] || '';
      
      rows.push({
        name,
        website: rawRow['elements__tags__website'] || rawRow['elements__tags__contact:website'] || '',
        email: rawRow['elements__tags__email'] || '',
        phone: rawRow['elements__tags__phone'] || rawRow['elements__tags__contact:phone'] || '',
        city: rawRow['elements__tags__addr:city'] || '',
        state: rawRow['elements__tags__addr:state'] || '',
        lat,
        lon,
        bio: rawRow['elements__tags__description'] || '',
      });
    } else {
      rows.push(rawRow as unknown as CSVRow);
    }
  }
  
  return rows;
}

function inferOpportunityType(name: string): 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer' {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('hospice')) return 'hospice';
  if (lowerName.includes('ems') || lowerName.includes('emt') || lowerName.includes('ambulance')) return 'emt';
  if (lowerName.includes('clinic') || lowerName.includes('center') || lowerName.includes('med spa')) return 'clinic';
  if (lowerName.includes('volunteer')) return 'volunteer';
  return 'hospital';
}

async function callEdgeFunction(body: object): Promise<{ success: boolean; imported?: number; error?: string }> {
  // Get current session to ensure auth token is available
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication session found. Please log in again.');
  }
  
  const { data, error } = await supabase.functions.invoke('import-csv-hospitals', {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}

interface DataSource {
  id: string;
  name: string;
  csvPath: string;
  description: string;
  isOSMFormat?: boolean;
}

const dataSources: DataSource[] = [
  {
    id: 'texas',
    name: 'Texas Hospitals',
    csvPath: '/data/texas-hospitals.csv',
    description: 'Import hospitals and clinics from Texas',
  },
  {
    id: 'west-coast',
    name: 'West Coast Hospitals',
    csvPath: '/data/west-coast-hospitals.csv',
    description: 'Import hospitals and clinics from California, Oregon, and Washington',
  },
  {
    id: 'middle-region',
    name: 'Middle Region',
    csvPath: '/data/middle-region-hospitals.csv',
    description: 'Import hospitals and clinics from Nevada, Colorado, Arizona, and surrounding states',
  },
  {
    id: 'batch3',
    name: 'Batch 3 (Mid)',
    csvPath: '/data/batch3-hospitals.csv',
    description: 'Additional hospitals from mid-region states (OSM data)',
    isOSMFormat: true,
  },
  {
    id: 'batch4',
    name: 'Batch 4 (Central/South)',
    csvPath: '/data/batch4-hospitals.csv',
    description: 'Hospitals from Iowa, Missouri, Arkansas and surrounding states',
    isOSMFormat: false,
  },
  {
    id: 'batch-shirt',
    name: 'Batch Shirt',
    csvPath: '/data/hospitals_lovable_ready_shivam.csv',
    description: '1339 hospitals from Michigan, Tennessee, and more (OpenStreetMap data)',
    isOSMFormat: false,
  },
  {
    id: 'batch5',
    name: 'Batch 5 (Amrit)',
    csvPath: '/data/batch5-hospitals.csv',
    description: '2473 hospitals from Michigan, Tennessee, West Virginia, and more (OpenStreetMap data)',
    isOSMFormat: false,
  },
  {
    id: 'batch-csv-5-raghav',
    name: 'Batch CSV 5 (Raghav)',
    csvPath: '/data/hospitals_lovable_ready_raghav.csv',
    description: '1339 hospitals from Michigan, Tennessee, and more (OpenStreetMap data)',
    isOSMFormat: false,
  },
  {
    id: 'laptop',
    name: 'Laptop',
    csvPath: '/data/lovablelaptop.csv',
    description: '1176 hospitals from various states (OpenStreetMap data)',
    isOSMFormat: false,
  },
  {
    id: 'desktop',
    name: 'Desktop',
    csvPath: '/data/hospitals_lovable_ready_desktop.csv',
    description: '816 hospitals from Northeast states (OpenStreetMap data)',
    isOSMFormat: false,
  },
];

const AdminImport = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [selectedSource, setSelectedSource] = useState<string>("texas");

  // Check authentication and admin role
  useEffect(() => {
    const checkAdminRole = async () => {
      if (authLoading) return;
      
      if (!user) {
        toast.error("Authentication required");
        navigate("/auth");
        return;
      }

      try {
        // Check if user has admin role
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("Error checking admin role:", error);
          toast.error("Failed to verify admin access");
          navigate("/dashboard");
          return;
        }

        if (!data) {
          toast.error("Admin access required");
          navigate("/dashboard");
          return;
        }

        setIsAdmin(true);
      } catch (err) {
        console.error("Admin check error:", err);
        toast.error("Failed to verify admin access");
        navigate("/dashboard");
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminRole();
  }, [user, authLoading, navigate]);

  const handleImport = async (clearExisting: boolean = true) => {
    const source = dataSources.find(s => s.id === selectedSource);
    if (!source) return;

    setImporting(true);
    setProgress(0);
    setStatus(`Fetching ${source.name} CSV data...`);
    
    try {
      // Fetch the CSV file
      const response = await fetch(source.csvPath);
      const csvText = await response.text();
      const rows = parseCSV(csvText, source.isOSMFormat);
      
      setStatus(`Parsed ${rows.length} hospitals. Processing...`);
      
      // Transform rows to opportunity objects
      const allOpportunities = rows
        .filter(row => row.name && row.lat && row.lon)
        .map(row => {
          const lat = parseFloat(row.lat);
          const lon = parseFloat(row.lon);
          
          if (isNaN(lat) || isNaN(lon)) return null;
          
          const location = [row.city, row.state].filter(Boolean).join(', ') || source.name;
          
          return {
            name: row.name.replace(/^"|"$/g, ''),
            type: inferOpportunityType(row.name),
            location,
            latitude: lat,
            longitude: lon,
            phone: row.phone || null,
            email: row.email || null,
            website: row.website || null,
            description: row.bio || null,
            hours_required: "Varies",
            acceptance_likelihood: "medium" as const,
            requirements: [],
          };
        })
        .filter(Boolean);
      
      if (clearExisting) {
        setStatus(`Clearing existing data...`);
        console.log("Calling edge function to clear data...");
        const clearResult = await callEdgeFunction({ opportunities: [], clearExisting: true });
        console.log("Clear result:", clearResult);
        
        if (!clearResult.success && clearResult.error) {
          throw new Error(clearResult.error);
        }
      }
      
      setStatus(`${clearExisting ? 'Data cleared. ' : ''}Importing ${allOpportunities.length} hospitals...`);
      
      // Insert in very small batches
      const batchSize = 10;
      let imported = 0;
      let failed = 0;
      const totalBatches = Math.ceil(allOpportunities.length / batchSize);
      
      for (let i = 0; i < allOpportunities.length; i += batchSize) {
        const batch = allOpportunities.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        try {
          console.log(`Sending batch ${batchNum}/${totalBatches}`);
          const data = await callEdgeFunction({ opportunities: batch, clearExisting: false });
          
          if (data.success) {
            imported += data.imported || 0;
          } else {
            console.error(`Batch ${batchNum} failed:`, data.error);
            failed += batch.length;
          }
        } catch (err) {
          console.error(`Batch ${batchNum} error:`, err);
          failed += batch.length;
        }
        
        const progressPercent = Math.round(((i + batchSize) / allOpportunities.length) * 100);
        setProgress(Math.min(progressPercent, 100));
        setStatus(`Batch ${batchNum}/${totalBatches}: ${imported} added, ${failed} failed`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setStatus(`Import complete! Added ${imported} hospitals. Failed: ${failed}`);
      toast.success(`Successfully imported ${imported} hospitals from ${source.name}!`);
    } catch (error) {
      console.error("Import error:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImportAll = async () => {
    setImporting(true);
    setProgress(0);
    
    try {
      // First clear and import Texas
      setStatus("Clearing existing data and importing Texas hospitals...");
      await handleImportSource(dataSources[0], true);
      
      // Then add West Coast without clearing
      setStatus("Adding West Coast hospitals...");
      await handleImportSource(dataSources[1], false);
      
      toast.success("Successfully imported all hospitals!");
    } catch (error) {
      console.error("Import all error:", error);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImportSource = async (source: DataSource, clearExisting: boolean) => {
    const response = await fetch(source.csvPath);
    const csvText = await response.text();
    const rows = parseCSV(csvText, source.isOSMFormat);
    
    const allOpportunities = rows
      .filter(row => row.name && row.lat && row.lon)
      .map(row => {
        const lat = parseFloat(row.lat);
        const lon = parseFloat(row.lon);
        
        if (isNaN(lat) || isNaN(lon)) return null;
        
        const location = [row.city, row.state].filter(Boolean).join(', ') || source.name;
        
        return {
          name: row.name.replace(/^"|"$/g, ''),
          type: inferOpportunityType(row.name),
          location,
          latitude: lat,
          longitude: lon,
          phone: row.phone || null,
          email: row.email || null,
          website: row.website || null,
          description: row.bio || null,
          hours_required: "Varies",
          acceptance_likelihood: "medium" as const,
          requirements: [],
        };
      })
      .filter(Boolean);
    
    if (clearExisting) {
      await callEdgeFunction({ opportunities: [], clearExisting: true });
    }
    
    const batchSize = 10;
    for (let i = 0; i < allOpportunities.length; i += batchSize) {
      const batch = allOpportunities.slice(i, i + batchSize);
      await callEdgeFunction({ opportunities: batch, clearExisting: false });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  // Show loading while checking auth/admin status
  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto pt-28 px-4 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Only render if user is admin
  if (!isAdmin) {
    return null;
  }

  const currentSource = dataSources.find(s => s.id === selectedSource);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto pt-28 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Import Hospitals & Clinics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={selectedSource} onValueChange={setSelectedSource}>
              <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                {dataSources.map(source => (
                  <TabsTrigger 
                    key={source.id} 
                    value={source.id} 
                    disabled={importing}
                    className="text-xs px-2 py-1.5 whitespace-nowrap"
                  >
                    {source.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {dataSources.map(source => (
                <TabsContent key={source.id} value={source.id}>
                  <p className="text-muted-foreground mb-4">
                    {source.description}
                  </p>
                </TabsContent>
              ))}
            </Tabs>
            
            <div className="space-y-3">
              <Button 
                onClick={() => handleImport(true)} 
                disabled={importing}
                className="w-full"
                variant="default"
              >
                {importing ? "Importing..." : `Clear All & Import ${currentSource?.name}`}
              </Button>
              
              <Button 
                onClick={() => handleImport(false)} 
                disabled={importing}
                className="w-full"
                variant="outline"
              >
                {importing ? "Importing..." : `Add ${currentSource?.name} (Keep Existing)`}
              </Button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <Button 
                onClick={handleImportAll} 
                disabled={importing}
                className="w-full"
                variant="secondary"
              >
                {importing ? "Importing..." : "Import All Regions (Clear & Import All)"}
              </Button>
            </div>
            
            {importing && (
              <Progress value={progress} className="w-full" />
            )}
            
            {status && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">{status}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminImport;
