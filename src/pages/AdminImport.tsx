import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";

const AdminImport = () => {
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string>("");

  const handleImport = async () => {
    setImporting(true);
    setStatus("Fetching CSV data...");
    
    try {
      // Fetch the CSV file from public folder
      const response = await fetch("/data/texas-hospitals.csv");
      const csvData = await response.text();
      
      setStatus("Sending to import function (this will run in background)...");
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke("import-csv-hospitals", {
        body: {
          csvData,
          clearExisting: true,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setStatus(`Import complete! Imported ${data.imported} hospitals. Failed: ${data.failed}`);
        toast.success(`Successfully imported ${data.imported} hospitals!`);
      } else {
        throw new Error(data?.error || "Import failed");
      }
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
              This will clear all existing opportunities and import the new Texas hospitals data with coordinates.
            </p>
            
            <Button 
              onClick={handleImport} 
              disabled={importing}
              className="w-full"
            >
              {importing ? "Importing..." : "Clear & Import Hospitals"}
            </Button>
            
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
