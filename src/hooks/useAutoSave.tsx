import { useEffect, useRef } from "react";

/**
 * Auto-save form data to localStorage
 * @param formData - The form data to save
 * @param storageKey - The localStorage key to use
 * @param enabled - Whether auto-save is enabled (default: true)
 */
export function useAutoSave<T extends Record<string, any>>(
  formData: T,
  storageKey: string,
  enabled: boolean = true
) {
  const isInitialMount = useRef(true);
  const previousDataRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;

    // Skip saving on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only save if data has changed
    const currentData = JSON.stringify(formData);
    if (currentData !== previousDataRef.current) {
      try {
        localStorage.setItem(storageKey, currentData);
        previousDataRef.current = currentData;
      } catch (error) {
        // Ignore localStorage errors (quota exceeded, etc.)
        console.warn("Failed to save to localStorage:", error);
      }
    }
  }, [formData, storageKey, enabled]);

  // Load saved data
  const loadSavedData = (): T | null => {
    if (!enabled) return null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  };

  // Clear saved data
  const clearSavedData = () => {
    try {
      localStorage.removeItem(storageKey);
      previousDataRef.current = "";
    } catch (error) {
      // Ignore errors
    }
  };

  return { loadSavedData, clearSavedData };
}

