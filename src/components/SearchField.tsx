import { Clear, Search } from "@mui/icons-material";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Delay before `onChange` fires while typing. Clearing is always immediate. */
  debounceMs?: number;
  sx?: SxProps<Theme>;
};

/**
 * Debounced search input used by the project list and the task views. Keeps
 * its own draft text so typing stays responsive while the (possibly heavy)
 * client-side filtering only runs once the user pauses.
 */
export const SearchField = ({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel = "Search",
  debounceMs = 300,
  sx,
}: SearchFieldProps) => {
  const [draft, setDraft] = useState(value);
  const timeoutRef = useRef<number | null>(null);

  // Sync when the parent resets the value (e.g. navigating between pages).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const commit = (next: string) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    onChange(next);
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (next.trim() === "") {
      commit("");
      return;
    }
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      onChange(next);
    }, debounceMs);
  };

  const handleClear = () => {
    setDraft("");
    commit("");
  };

  return (
    <TextField
      size="small"
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && draft !== "") {
          e.stopPropagation();
          handleClear();
        }
      }}
      placeholder={placeholder}
      inputProps={{ "aria-label": ariaLabel }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search fontSize="small" color="action" />
          </InputAdornment>
        ),
        endAdornment: draft ? (
          <InputAdornment position="end">
            <IconButton size="small" aria-label="Clear search" onClick={handleClear} edge="end">
              <Clear fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      sx={[
        { minWidth: { xs: "100%", sm: 220 }, bgcolor: "background.paper" },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  );
};
