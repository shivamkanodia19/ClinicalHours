import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerationRequest {
  content: string | { title: string; body?: string };
  contentType: 'review' | 'question' | 'answer';
}

interface ModerationResult {
  approved: boolean;
  reason?: string;
  flagged_categories: string[];
}

// Profanity word list (basic set - can be expanded)
const PROFANITY_WORDS = [
  // Common profanity terms (using asterisks to avoid explicit content)
  'f***', 's***', 'a**', 'b****', 'd***', 'h***', 'c***', 'p***', 't***',
  // Variations
  'f u c k', 's h i t', 'a s s', 'b i t c h', 'd a m n',
  // Additional offensive terms
  'stupid', 'idiot', 'moron', 'retard', 'nazi', 'hitler',
];

// Suspicious domains that should be flagged
const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'short.link',
  // Add more as needed
];

// Check for profanity
function checkProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_WORDS.some(word => {
    // Check for word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word.replace(/\*/g, '\\w*')}\\b`, 'i');
    return regex.test(lowerText);
  });
}

// Check for spam patterns
function checkSpam(text: string): boolean {
  // Check for excessive repetition of characters (e.g., "aaaaaa")
  if (/(.)\1{4,}/.test(text)) {
    return true;
  }

  // Check for excessive capitalization (>50% of letters are uppercase)
  const letters = text.match(/[a-zA-Z]/g);
  if (letters) {
    const upperCount = letters.filter(c => c === c.toUpperCase()).length;
    const upperPercentage = upperCount / letters.length;
    if (upperPercentage > 0.5 && letters.length > 10) {
      return true;
    }
  }

  // Check for repetitive words/phrases (same word repeated 5+ times)
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    if (word.length > 2) { // Ignore short words
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      if (wordCounts.get(word)! >= 5) {
        return true;
      }
    }
  }

  return false;
}

// Check for personal information
function checkPersonalInfo(text: string): { found: boolean; type?: string } {
  // Email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  if (emailRegex.test(text)) {
    return { found: true, type: 'email' };
  }

  // Phone number patterns (US format)
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  if (phoneRegex.test(text)) {
    return { found: true, type: 'phone' };
  }

  // SSN pattern (XXX-XX-XXXX)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;
  if (ssnRegex.test(text)) {
    return { found: true, type: 'ssn' };
  }

  return { found: false };
}

// Check for suspicious links
function checkLinks(text: string): { found: boolean; suspicious: boolean } {
  // URL pattern
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlRegex);
  
  if (!urls || urls.length === 0) {
    return { found: false, suspicious: false };
  }

  // Check if any URLs contain suspicious domains
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check against suspicious domains list
      if (SUSPICIOUS_DOMAINS.some(domain => hostname.includes(domain))) {
        return { found: true, suspicious: true };
      }
      
      // Check for suspicious patterns in URL
      if (hostname.length < 5 || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        return { found: true, suspicious: true };
      }
    } catch {
      // Invalid URL format
      return { found: true, suspicious: true };
    }
  }

  return { found: true, suspicious: false };
}

// Main moderation function
function moderateContent(content: string): ModerationResult {
  const flaggedCategories: string[] = [];
  
  // Check profanity
  if (checkProfanity(content)) {
    flaggedCategories.push('profanity');
  }
  
  // Check spam
  if (checkSpam(content)) {
    flaggedCategories.push('spam');
  }
  
  // Check personal information
  const personalInfoCheck = checkPersonalInfo(content);
  if (personalInfoCheck.found) {
    flaggedCategories.push(`personal_info_${personalInfoCheck.type}`);
  }
  
  // Check links
  const linkCheck = checkLinks(content);
  if (linkCheck.suspicious) {
    flaggedCategories.push('suspicious_links');
  }
  
  const approved = flaggedCategories.length === 0;
  
  let reason: string | undefined;
  if (!approved) {
    if (flaggedCategories.includes('profanity')) {
      reason = 'Content contains inappropriate language';
    } else if (flaggedCategories.includes('spam')) {
      reason = 'Content appears to be spam';
    } else if (flaggedCategories.some(cat => cat.startsWith('personal_info_'))) {
      reason = 'Content contains personal information that should not be shared';
    } else if (flaggedCategories.includes('suspicious_links')) {
      reason = 'Content contains suspicious links';
    } else {
      reason = 'Content does not meet our community guidelines';
    }
  }
  
  return {
    approved,
    reason,
    flagged_categories: flaggedCategories,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, contentType }: ModerationRequest = await req.json();

    // Validate input
    if (!content || (typeof content !== 'string' && typeof content !== 'object')) {
      return new Response(
        JSON.stringify({ error: 'Content is required and must be a string or object' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!contentType || !['review', 'question', 'answer'].includes(contentType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type. Must be review, question, or answer' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Combine title and body for questions if content is an object
    let textToCheck: string;
    if (typeof content === 'object' && content !== null) {
      const questionContent = content as { title: string; body?: string };
      textToCheck = `${questionContent.title || ''} ${questionContent.body || ''}`.trim();
    } else {
      textToCheck = content as string;
    }

    // Perform moderation
    const result = moderateContent(textToCheck);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Moderation error:', error);
    // Fail open - allow content if moderation service fails
    return new Response(
      JSON.stringify({
        approved: true,
        reason: 'Moderation service unavailable',
        flagged_categories: [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

