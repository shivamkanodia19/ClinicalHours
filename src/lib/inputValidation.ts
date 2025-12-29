// Input validation and sanitization utilities

/**
 * Sanitizes text input by trimming whitespace
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return "";
  return input.trim();
}

/**
 * Validates phone number format (US format)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim() === "") return { valid: true }; // Optional field
  
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, "");
  
  // US phone numbers: 10 digits (or 11 with country code)
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return { valid: true };
  }
  
  return { 
    valid: false, 
    error: "Please enter a valid phone number (10 digits)" 
  };
}

/**
 * Validates GPA range (0-4.0)
 */
export function validateGPA(gpa: string | null | undefined): { valid: boolean; error?: string } {
  if (!gpa || gpa.trim() === "") return { valid: true }; // Optional field
  
  const numGPA = parseFloat(gpa);
  
  if (isNaN(numGPA)) {
    return { valid: false, error: "GPA must be a number" };
  }
  
  if (numGPA < 0 || numGPA > 4.0) {
    return { valid: false, error: "GPA must be between 0 and 4.0" };
  }
  
  return { valid: true };
}

/**
 * Validates graduation year
 */
export function validateGraduationYear(year: string | null | undefined): { valid: boolean; error?: string } {
  if (!year || year.trim() === "") return { valid: false, error: "Graduation year is required" };
  
  const numYear = parseInt(year);
  const currentYear = new Date().getFullYear();
  
  if (isNaN(numYear)) {
    return { valid: false, error: "Graduation year must be a number" };
  }
  
  if (numYear < 1900 || numYear > currentYear + 10) {
    return { valid: false, error: `Graduation year must be between 1900 and ${currentYear + 10}` };
  }
  
  return { valid: true };
}

/**
 * Validates URL format
 */
export function validateURL(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url || url.trim() === "") return { valid: true }; // Optional field
  
  try {
    const urlObj = new URL(url);
    // Check if it's a valid HTTP/HTTPS URL
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { valid: false, error: "URL must start with http:// or https://" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Please enter a valid URL" };
  }
}

/**
 * Validates LinkedIn URL specifically
 */
export function validateLinkedInURL(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url || url.trim() === "") return { valid: true }; // Optional field
  
  const urlValidation = validateURL(url);
  if (!urlValidation.valid) {
    return urlValidation;
  }
  
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes("linkedin.com")) {
      return { valid: false, error: "Please enter a valid LinkedIn URL" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Please enter a valid LinkedIn URL" };
  }
}

/**
 * Sanitizes all profile fields before submission
 */
export function sanitizeProfileData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  // Text fields - trim whitespace
  const textFields = ['full_name', 'city', 'state', 'university', 'major', 'pre_med_track', 'bio', 'career_goals', 'research_experience'];
  textFields.forEach(field => {
    if (data[field] !== undefined) {
      sanitized[field] = sanitizeTextInput(data[field]);
    }
  });
  
  // Phone - trim and keep as is (validation happens separately)
  if (data.phone !== undefined) {
    sanitized.phone = sanitizeTextInput(data.phone);
  }
  
  // URL fields - trim
  if (data.linkedin_url !== undefined) {
    sanitized.linkedin_url = sanitizeTextInput(data.linkedin_url);
  }
  
  // Numeric fields - keep as is (validation happens separately)
  if (data.gpa !== undefined) sanitized.gpa = data.gpa;
  if (data.graduation_year !== undefined) sanitized.graduation_year = data.graduation_year;
  if (data.clinical_hours !== undefined) sanitized.clinical_hours = data.clinical_hours;
  
  // Keep other fields as is
  Object.keys(data).forEach(key => {
    if (!sanitized.hasOwnProperty(key)) {
      sanitized[key] = data[key];
    }
  });
  
  return sanitized;
}

