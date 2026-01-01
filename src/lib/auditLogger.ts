// Audit Logging Utility
// Logs security-relevant events for monitoring and investigation

import { logger } from "./logger";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  event_type: string;
  user_id?: string | null;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  eventType: string,
  details?: Record<string, any>,
  severity: "low" | "medium" | "high" | "critical" = "medium"
): Promise<void> {
  try {
    // Don't block on getting user - make it non-blocking
    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch (authError) {
      // Ignore auth errors - user might not be logged in
    }
    
    const logEntry: AuditLogEntry = {
      event_type: eventType,
      user_id: userId,
      details: details || {},
      severity,
      timestamp: new Date().toISOString(),
    };

    // Log to console in development, would send to logging service in production
    if (logger && logger.info) {
      logger.info("Audit Event", logEntry);
    } else {
      console.log("Audit Event", logEntry);
    }

    // In production, you would send this to:
    // - A logging service (e.g., LogRocket, Sentry)
    // - A database table for audit logs
    // - A security information and event management (SIEM) system
    
    // Example: Store in Supabase audit_logs table (if created)
    // await supabase.from("audit_logs").insert({
    //   event_type: eventType,
    //   user_id: user?.id,
    //   details: details,
    //   severity,
    //   created_at: new Date().toISOString(),
    // });
  } catch (error) {
    // Don't fail the operation if logging fails - silently ignore
    if (logger && logger.error) {
      logger.error("Failed to log audit event", error);
    }
  }
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  eventType: "login_success" | "login_failure" | "logout" | "signup" | "password_reset_request" | "password_reset_success",
  details?: Record<string, any>
): void {
  const severity = eventType.includes("failure") ? "high" : "medium";
  logAuditEvent(`auth_${eventType}`, details, severity);
}

/**
 * Log profile update events
 */
export function logProfileUpdate(fields: string[]): void {
  logAuditEvent("profile_update", { fields }, "medium");
}

/**
 * Log file access events
 */
export function logFileAccess(fileType: string, filePath: string): void {
  logAuditEvent("file_access", { file_type: fileType, file_path: filePath }, "medium");
}

/**
 * Log admin actions
 */
export function logAdminAction(action: string, details?: Record<string, any>): void {
  logAuditEvent(`admin_${action}`, details, "high");
}

/**
 * Log security violations
 */
export function logSecurityViolation(violationType: string, details?: Record<string, any>): void {
  logAuditEvent(`security_violation_${violationType}`, details, "critical");
}

