// Utility functions for sanitizing error messages
// Removes references to internal services and provides user-friendly messages

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  let errorMessage = "";
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (typeof error === "object" && "message" in error) {
    errorMessage = String((error as { message: unknown }).message);
  } else {
    return "An unexpected error occurred. Please try again.";
  }

  // Remove references to internal services
  const sanitized = errorMessage
    .replace(/supabase/gi, "service")
    .replace(/lovable/gi, "platform")
    .replace(/\.supabase\.co/gi, "")
    .replace(/storage\.v1/gi, "")
    .replace(/ERR_BLOCKED_BY_CLIENT/gi, "blocked")
    .replace(/network error/gi, "connection error")
    .replace(/fetch failed/gi, "connection failed");

  // Common error code mappings
  if (errorMessage.includes("23505") || errorMessage.includes("duplicate") || errorMessage.includes("unique")) {
    return "This item already exists. Please check and try again.";
  }

  if (errorMessage.includes("23503") || errorMessage.includes("foreign key")) {
    return "Invalid reference. Please check your input and try again.";
  }

  if (errorMessage.includes("23514") || errorMessage.includes("check constraint")) {
    return "Invalid input. Please check your data and try again.";
  }

  if (errorMessage.includes("JWT") || errorMessage.includes("token") || errorMessage.includes("unauthorized")) {
    return "Your session has expired. Please sign in again.";
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("timeout")) {
    return "Connection error. Please check your internet connection and try again.";
  }

  if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // If sanitized message is too technical or empty, return generic message
  if (sanitized.length === 0 || sanitized.length > 200 || sanitized.includes("Error:") || sanitized.includes("at ")) {
    return "An unexpected error occurred. Please try again.";
  }

  return sanitized;
}

export function sanitizeErrorForLogging(error: unknown): unknown {
  // For logging purposes, we can keep more details but still sanitize URLs
  if (error instanceof Error) {
    const sanitized = new Error(error.message);
    sanitized.name = error.name;
    sanitized.stack = error.stack?.replace(/\.supabase\.co[^\s]*/gi, "[REDACTED]");
    return sanitized;
  }
  return error;
}

