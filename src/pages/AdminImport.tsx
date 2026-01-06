import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { Progress } from "@/components/ui/progress";

interface CSVRow {
  name: string;
  website: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  lat: string;
  lon: string;
}

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
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
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row as unknown as CSVRow);
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

const AdminImport = () => {
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setStatus("Fetching CSV data...");
    
    try {
      // Fetch the CSV file
      const response = await fetch("/data/texas-hospitals.csv");
      const csvText = await response.text();
      const rows = parseCSV(csvText);
      
      setStatus(`Parsed ${rows.length} hospitals. Processing...`);
      
      // Transform rows to opportunity objects
      const allOpportunities = rows
        .filter(row => row.name && row.lat && row.lon)
        .map(row => {
          const lat = parseFloat(row.lat);
          const lon = parseFloat(row.lon);
          
          if (isNaN(lat) || isNaN(lon)) return null;
          
          const location = [row.city, row.state].filter(Boolean).join(', ') || 'Texas';
          
          return {
            name: row.name.replace(/^"|"$/g, ''),
            type: inferOpportunityType(row.name),
            location,
            latitude: lat,
            longitude: lon,
            phone: row.phone || null,
            email: row.email || null,
            website: row.website || null,
            description: null,
            hours_required: "Varies",
            acceptance_likelihood: "medium" as const,
            requirements: [],
          };
        })
        .filter(Boolean);
      
      setStatus(`Clearing existing data and importing ${allOpportunities.length} hospitals...`);
      
      // First call: clear existing and import first batch
      const batchSize = 100;
      let imported = 0;
      
      for (let i = 0; i < allOpportunities.length; i += batchSize) {
        const batch = allOpportunities.slice(i, i + batchSize);
        const isFirst = i === 0;
        
        const { data, error } = await supabase.functions.invoke("import-csv-hospitals", {
          body: {
            opportunities: batch,
            clearExisting: isFirst,
          },
        });

        if (error) {
          console.error("Batch error:", error);
          throw error;
        }
        
        if (data?.success) {
          imported += data.imported || 0;
        } else {
          throw new Error(data?.error || "Import failed");
        }
        
        const progressPercent = Math.round(((i + batchSize) / allOpportunities.length) * 100);
        setProgress(Math.min(progressPercent, 100));
        setStatus(`Importing... ${imported} hospitals added (${Math.min(progressPercent, 100)}%)`);
      }
      
      setStatus(`Import complete! Added ${imported} hospitals.`);
      toast.success(`Successfully imported ${imported} hospitals!`);
    } catch (error) {
      console.error("Import error:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto pt-28 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Import Texas Hospitals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This will clear all existing opportunities and import the new Texas hospitals data with coordinates for the map.
            </p>
            
            <Button 
              onClick={handleImport} 
              disabled={importing}
              className="w-full"
            >
              {importing ? "Importing..." : "Clear & Import Hospitals"}
            </Button>
            
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
