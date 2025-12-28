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
  // Validate input
  if (!content || typeof content !== 'string') {
    return {
      approved: true,
      flagged_categories: [],
    };
  }

  try {
    // Get the Supabase URL and anon key safely
    const supabaseUrl = typeof import.meta !== 'undefined' && import.meta.env 
      ? import.meta.env.VITE_SUPABASE_URL 
      : undefined;
    const supabaseAnonKey = typeof import.meta !== 'undefined' && import.meta.env 
      ? import.meta.env.VITE_SUPABASE_ANON_KEY 
      : undefined;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables not configured, skipping moderation');
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
      const errorText = await response.text();
      console.error(`Moderation API error (${response.status}):`, errorText);
      throw new Error(`Moderation API returned ${response.status}: ${errorText}`);
    }

    const result: ModerationResult = await response.json();
    
    // Log moderation result for debugging
    if (!result.approved) {
      console.warn('Content rejected by moderation:', result);
    }
    
    return result;
  } catch (error) {
    console.error('Error calling moderation service:', error);
    // For now, fail open but log the error
    // In production, you might want to fail closed for certain errors
    console.warn('Moderation service failed, allowing content (fail-open mode)');
    return {
      approved: true,
      reason: 'Moderation service unavailable',
      flagged_categories: [],
    };
  }
}

