import { Client } from "@taruvi/sdk";

// Validate required environment variables
const requiredEnvVars = {
  VITE_TARUVI_BASE_URL: import.meta.env.VITE_TARUVI_BASE_URL,
  VITE_TARUVI_APP_SLUG: import.meta.env.VITE_TARUVI_APP_SLUG,
};

// The browser authenticates with the user's session token (X-Session-Token,
// set after the login redirect), never with an API key: @taruvi/sdk's
// HttpClient does not attach `apiKey` to any request. The SDK constructor
// still insists the field is non-empty, so when no key is configured we hand
// it an obviously-non-secret placeholder rather than shipping a real key to
// every visitor's browser. VITE_TARUVI_API_KEY is therefore optional.
const API_KEY_PLACEHOLDER = "session-auth";
const configuredApiKey = String(import.meta.env.VITE_TARUVI_API_KEY ?? "").trim();

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Please check your .env.local file. See .env.example for required variables.`
    );
  }
});

/**
 * Taruvi Client instance configured with environment variables.
 * Used for Navkit, DataProviders, and direct SDK operations.
 *
 * @example
 * // Use with Refine providers (recommended)
 * import { taruviDataProvider, taruviAuthProvider } from "./providers/refineProviders";
 *
 * @example
 * // Direct SDK usage (advanced)
 * import { taruviClient } from "./taruviClient";
 * const response = await taruviClient.httpClient.get("api/...");
 *
 * @see {@link https://docs.taruvi.com|Taruvi Documentation}
 */
export const taruviClient = (() => {
  try {
    return new Client({
      apiKey: configuredApiKey || API_KEY_PLACEHOLDER,
      appSlug: import.meta.env.VITE_TARUVI_APP_SLUG,
      apiUrl: import.meta.env.VITE_TARUVI_BASE_URL,
    });
  } catch (error) {
    console.error("Failed to initialize Taruvi Client:", error);
    throw new Error(
      "Taruvi configuration error. Please check your .env.local file. " +
        "See .env.example for required variables."
    );
  }
})();
