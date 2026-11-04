import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { taruviClient } from "../../taruviClient";

/**
 * App Settings Context
 * Fetches and manages app-level settings from the Taruvi API
 * Falls back to environment variables if API call fails
 */

// API Response Types
interface AppSettingsAPIResponse {
  status: string;
  message?: string;
  data: {
    display_name: string;
    icon: string | null;
    icon_url: string | null;
    primary_color: string;
    secondary_color: string;
    banner_image: string | null;
    banner_image_url: string | null;
    category: string;
    documentation_url: string;
    support_email: string;
    default_frontend_worker_url: string | null;
    created_at: string;
    updated_at: string;
  };
}

// Simplified Settings for Context
export interface AppSettings {
  displayName: string;
  iconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  bannerImageUrl: string | null;
  category: string;
  documentationUrl: string;
  supportEmail: string;
}

// Context Type
export interface AppSettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Default settings from environment variables
const getDefaultSettings = (): AppSettings => ({
  displayName: import.meta.env.VITE_TARUVI_APP_TITLE || "App",
  iconUrl: null,
  primaryColor: "#EAB308", // Default yellow
  secondaryColor: "#8B5CF6", // Default purple
  bannerImageUrl: null,
  category: "general",
  documentationUrl: "",
  supportEmail: "",
});

// Create Context
const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: getDefaultSettings(),
  isLoading: true,
  error: null,
  refetch: async () => {},
});

// Provider Component
export const AppSettingsProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {console.log("Settings updated:", settings)}, [settings]);
  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const appSlug = import.meta.env.VITE_TARUVI_APP_SLUG;

      if (!appSlug) {
        throw new Error("VITE_TARUVI_APP_SLUG is not defined");
      }

      const response = await taruviClient.httpClient.get<AppSettingsAPIResponse>(
        `api/apps/${appSlug}/settings/`
      );
      console.log("Fetched app settings:", response.data);
      if (response?.status === "success" && response?.data) {
        const apiData = response.data;
        
        setSettings({
          displayName: apiData.display_name || getDefaultSettings().displayName,
          iconUrl: apiData.icon_url,
          primaryColor: apiData.primary_color || getDefaultSettings().primaryColor,
          secondaryColor:
            apiData.secondary_color || getDefaultSettings().secondaryColor,
          bannerImageUrl: apiData.banner_image_url,
          category: apiData.category || "general",
          documentationUrl: apiData.documentation_url || "",
          supportEmail: apiData.support_email || "",
        });
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (err) {
      console.error("Failed to fetch app settings, using defaults:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
      // Keep default settings on error (already set in initial state)
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []); // Fetch once on mount

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        isLoading,
        error,
        refetch: fetchSettings,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

// Custom Hook
export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }

  return context;
};
