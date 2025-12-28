import { supabase } from "@/integrations/supabase/client";

export type ContentType = 'review' | 'question' | 'answer';

export interface ModerationResult {
  approved: boolean;
  reason?: string;
  flagged_categories: string[];
}

export interface ModerationRequest {
  content: string;
  contentType: ContentType;
}

/**
 * Moderates content by calling the Supabase Edge Function
 * @param content - The text content to moderate
 * @param contentType - The type of content (review, question, or answer)
 * @returns Promise with moderation result
 */
export async function moderateContent(
  content: string,
  contentType: ContentType
): Promise<ModerationResult> {
  try {
    // Get the Supabase URL and anon key
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase environment variables not configured');
      // Fail open - allow content if configuration is missing
      return {
        approved: true,
        flagged_categories: [],
      };
    }

    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/moderate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        content,
        contentType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Moderation API returned ${response.status}`);
    }

    const result: ModerationResult = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling moderation service:', error);
    // Fail open - allow content if moderation service fails
    return {
      approved: true,
      reason: 'Moderation service unavailable',
      flagged_categories: [],
    };
  }
}

