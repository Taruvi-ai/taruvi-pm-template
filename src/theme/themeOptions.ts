import { ThemeOptions } from "@mui/material/styles";

const BODY_FONT_FAMILY = "'Open Sans', sans-serif";
const HEADING_FONT_FAMILY = "'Quicksand', sans-serif";

export const lightThemeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    primary: {
      main: '#1565c0',
      light: '#64b5f6',
      dark: '#0d47a1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#475569',
      light: '#cbd5e1',
      dark: '#1e293b',
      contrastText: '#ffffff',
    },
    error: {
      main: '#C2185B',
      light: '#f8bbd0',
      dark: '#ad1457',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#ffe082',
      dark: '#e65100',
      contrastText: '#000000',
    },
    info: {
      main: '#1E88E5',
      light: '#4fc3f7',
      dark: '#01579b',
      contrastText: '#ffffff',
    },
    success: {
      main: '#0a7d5a',
      light: '#81c784',
      dark: '#047857',
      contrastText: '#ffffff',
    },
    background: {
      default: '#ffffff',
      paper: '#f8fafc',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
  },
  typography: {
    fontSize: 12,
    fontFamily: BODY_FONT_FAMILY,
    h1: { fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.2, fontFamily: HEADING_FONT_FAMILY },
    h2: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.2, fontFamily: HEADING_FONT_FAMILY },
    h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3, fontFamily: HEADING_FONT_FAMILY },
    h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3, fontFamily: HEADING_FONT_FAMILY },
    h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    h6: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    body1: { fontSize: '0.8125rem', lineHeight: 1.4, fontFamily: BODY_FONT_FAMILY },
    body2: { fontSize: '0.75rem', lineHeight: 1.4, fontFamily: BODY_FONT_FAMILY },
    button: { fontSize: '0.8125rem', fontWeight: 500, textTransform: 'none' },
    caption: { fontSize: '0.6875rem', lineHeight: 1.3, fontFamily: BODY_FONT_FAMILY },
    subtitle1: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    overline: { fontFamily: HEADING_FONT_FAMILY },
  },
  shape: {
    borderRadius: 6,
  },
  spacing: 6,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '4px 12px',
          fontSize: '0.8125rem',
          minHeight: '32px',
        },
        sizeSmall: {
          padding: '2px 8px',
          fontSize: '0.75rem',
          minHeight: '28px',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            fontSize: '0.8125rem',
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.8125rem',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          padding: '8px',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '8px',
          '&:last-child': {
            paddingBottom: '8px',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.6875rem',
          height: '20px',
        },
        sizeSmall: {
          fontSize: '0.625rem',
          height: '18px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          padding: '12px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          padding: '8px 12px',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: '6px',
        },
        sizeSmall: {
          padding: '4px',
        },
      },
    },
  },
};

export const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#64b5f6',
      light: '#90caf9',
      dark: '#1e88e5',
      contrastText: '#0f172a',
    },
    secondary: {
      main: '#cbd5e1',
      light: '#e2e8f0',
      dark: '#94a3b8',
      contrastText: '#0f172a',
    },
    error: {
      main: '#C2185B',
      light: '#f8bbd0',
      dark: '#c2185b',
      contrastText: '#0f172a',
    },
    warning: {
      main: '#f59e0b',
      light: '#fde68a',
      dark: '#e65100',
      contrastText: '#0f172a',
    },
    info: {
      main: '#1E88E5',
      light: '#81d4fa',
      dark: '#0288d1',
      contrastText: '#0f172a',
    },
    success: {
      main: '#0a7d5a',
      light: '#6ee7b7',
      dark: '#059669',
      contrastText: '#0f172a',
    },
    background: {
      default: '#020617',
      paper: '#020617',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
    },
  },
  typography: {
    fontSize: 12,
    fontFamily: BODY_FONT_FAMILY,
    h1: { fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.2, fontFamily: HEADING_FONT_FAMILY },
    h2: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.2, fontFamily: HEADING_FONT_FAMILY },
    h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3, fontFamily: HEADING_FONT_FAMILY },
    h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3, fontFamily: HEADING_FONT_FAMILY },
    h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    h6: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    body1: { fontSize: '0.8125rem', lineHeight: 1.4, fontFamily: BODY_FONT_FAMILY },
    body2: { fontSize: '0.75rem', lineHeight: 1.4, fontFamily: BODY_FONT_FAMILY },
    button: { fontSize: '0.8125rem', fontWeight: 500, textTransform: 'none' },
    caption: { fontSize: '0.6875rem', lineHeight: 1.3, fontFamily: BODY_FONT_FAMILY },
    subtitle1: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.4, fontFamily: HEADING_FONT_FAMILY },
    overline: { fontFamily: HEADING_FONT_FAMILY },
  },
  shape: {
    borderRadius: 6,
  },
  spacing: 6,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '4px 12px',
          fontSize: '0.8125rem',
          minHeight: '32px',
        },
        sizeSmall: {
          padding: '2px 8px',
          fontSize: '0.75rem',
          minHeight: '28px',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            fontSize: '0.8125rem',
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.8125rem',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          padding: '8px',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '8px',
          '&:last-child': {
            paddingBottom: '8px',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.6875rem',
          height: '20px',
        },
        sizeSmall: {
          fontSize: '0.625rem',
          height: '18px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          padding: '12px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          padding: '8px 12px',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: '6px',
        },
        sizeSmall: {
          padding: '4px',
        },
      },
    },
  },
};
