import { ThemeProvider, createTheme } from "@mui/material/styles";
import React, {
  PropsWithChildren,
  createContext,
  useEffect,
  useState,
} from "react";
import { lightThemeOptions, darkThemeOptions } from "../../../themeOptions";

type ColorModeContextType = {
  mode: string;
  setMode: (mode?: "light" | "dark") => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
  {} as ColorModeContextType
);

export const ColorModeContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const colorModeFromLocalStorage = localStorage.getItem("colorMode");
  const isSystemPreferenceDark = window?.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  const systemPreference = isSystemPreferenceDark ? "dark" : "light";
  const [mode, setMode] = useState(
    colorModeFromLocalStorage || systemPreference
  );

  useEffect(() => {
    window.localStorage.setItem("colorMode", mode);
  }, [mode]);

  const setColorMode = (newMode?: "light" | "dark") => {
    if (newMode) {
      // Set specific mode
      setMode(newMode);
    } else {
      // Toggle mode
      setMode((prevMode) => prevMode === "light" ? "dark" : "light");
    }
  };

  const theme = React.useMemo(
    () => createTheme(mode === "light" ? lightThemeOptions : darkThemeOptions),
    [mode]
  );

  return (
    <ColorModeContext.Provider
      value={{
        setMode: setColorMode,
        mode,
      }}
    >
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
