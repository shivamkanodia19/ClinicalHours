// Helper functions for consistent toast notifications with appropriate timeouts
import { toast as sonnerToast } from "sonner";

/**
 * Show success toast (shorter duration - 3 seconds)
 */
export function toastSuccess(message: string, description?: string) {
  return sonnerToast.success(message, {
    description,
    duration: 3000,
  });
}

/**
 * Show error toast (longer duration - 6 seconds so users can read it)
 */
export function toastError(message: string, description?: string) {
  return sonnerToast.error(message, {
    description,
    duration: 6000,
  });
}

/**
 * Show info toast (medium duration - 4 seconds)
 */
export function toastInfo(message: string, description?: string) {
  return sonnerToast.info(message, {
    description,
    duration: 4000,
  });
}

/**
 * Show warning toast (medium duration - 5 seconds)
 */
export function toastWarning(message: string, description?: string) {
  return sonnerToast.warning(message, {
    description,
    duration: 5000,
  });
}

