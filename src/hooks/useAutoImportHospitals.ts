import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 500;
const TOTAL_HOSPITALS = 5421;
const MIN_HOSPITALS_THRESHOLD = 200;

export function useAutoImportHospitals() {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function checkAndImport() {
      try {
        // Check current hospital count
        const { count, error: countError } = await supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'hospital');

        if (countError) {
          logger.error('Error checking hospital count', countError);
          return;
        }

        const currentCount = count || 0;
        logger.info(`Current hospital count: ${currentCount}`);

        // If we already have enough hospitals, skip import
        if (currentCount >= MIN_HOSPITALS_THRESHOLD) {
          logger.info('Hospitals already imported, skipping auto-import');
          return;
        }

        // Start importing
        toast({
          title: "Importing real hospitals...",
          description: "Fetching verified hospital data from CMS government database",
        });

        let totalImported = 0;
        let offset = 0;

        // Import in batches
        while (offset < TOTAL_HOSPITALS) {
          logger.info(`Importing batch starting at offset ${offset}...`);
          
          const response = await supabase.functions.invoke('import-hospitals', {
            body: { 
              limit: BATCH_SIZE, 
              offset: offset 
            }
          });

          if (response.error) {
            logger.error('Import batch error', response.error);
            break;
          }

          const data = response.data;
          totalImported += data.imported || 0;
          
          logger.info(`Batch complete: imported ${data.imported}, skipped ${data.skipped}, failed ${data.failed}`);

          // Show progress every 1000 hospitals
          if (totalImported > 0 && totalImported % 1000 < BATCH_SIZE) {
            toast({
              title: `Imported ${totalImported} hospitals`,
              description: `${Math.round((offset / TOTAL_HOSPITALS) * 100)}% complete...`,
            });
          }

          // If no more hospitals to fetch, stop
          if ((data.imported || 0) + (data.skipped || 0) + (data.failed || 0) < BATCH_SIZE) {
            break;
          }

          offset += BATCH_SIZE;
          
          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        toast({
          title: "Hospital import complete!",
          description: `Successfully imported ${totalImported} verified hospitals`,
        });

      } catch (error) {
        logger.error('Auto-import error', error);
      }
    }

    // Start import after a delay to let the app load - increased delay for better initial load
    setTimeout(checkAndImport, 5000);
  }, []);
}
