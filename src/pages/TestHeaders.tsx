import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCSRFToken } from "@/lib/csrf";

export default function TestHeaders() {
  const [cspHeader, setCspHeader] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string>("");

  const checkCSP = async () => {
    try {
      const response = await fetch(window.location.origin, { method: "HEAD" });
      const csp = response.headers.get("content-security-policy");
      setCspHeader(csp || "NOT FOUND");
    } catch (error) {
      setCspHeader("ERROR: " + (error instanceof Error ? error.message : "Unknown"));
    }
  };

  const checkCSRF = async () => {
    try {
      const token = await getCSRFToken();
      setCsrfToken(token ? `Found: ${token.substring(0, 20)}...` : "NOT FOUND");
    } catch (error) {
      setCsrfToken("ERROR: " + (error instanceof Error ? error.message : "Unknown"));
    }
  };

  const testPOST = async () => {
    try {
      // Make a test POST request to see if CSRF token is included
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          name: "Test",
          email: "test@test.com",
          subject: "Test",
          message: "Test message",
        },
      });

      if (error) {
        setTestResult(`Error: ${error.message}`);
      } else {
        setTestResult("Success! Check Network tab → Request Headers → X-CSRF-Token");
      }
    } catch (error) {
      setTestResult("Error: " + (error instanceof Error ? error.message : "Unknown"));
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Security Headers Test</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">CSP Header Check</h2>
          <button onClick={checkCSP} className="bg-blue-500 text-white px-4 py-2 rounded mb-2">
            Check CSP Header
          </button>
          <p className="mt-2">
            <strong>Result:</strong> {cspHeader || "Not checked yet"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Note: In production, CSP headers must be configured at hosting/CDN level.
          </p>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">CSRF Token Check</h2>
          <button onClick={checkCSRF} className="bg-green-500 text-white px-4 py-2 rounded mb-2">
            Check CSRF Token
          </button>
          <p className="mt-2">
            <strong>Result:</strong> {csrfToken || "Not checked yet"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Note: You must be signed in for CSRF tokens to be available.
          </p>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Test POST Request</h2>
          <button onClick={testPOST} className="bg-purple-500 text-white px-4 py-2 rounded mb-2">
            Make Test POST Request
          </button>
          <p className="mt-2">
            <strong>Result:</strong> {testResult || "Not tested yet"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            After clicking, check Network tab → find POST request → Headers → Request Headers → X-CSRF-Token
          </p>
        </div>
      </div>
    </div>
  );
}

