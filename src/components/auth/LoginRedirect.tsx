import { useEffect } from "react";
import { useLogin } from "@refinedev/core";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

/**
 * Component that triggers redirect-based login flow.
 * Shows a loading indicator while redirecting to the backend login page.
 */
export const LoginRedirect: React.FC = () => {
  const { mutate: login } = useLogin();

  useEffect(() => {
    // Trigger the redirect-based login with full callback URL
    const callbackUrl = window.location.origin + window.location.pathname;
    login({ redirect: true, callbackUrl });
  }, [login]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1">Redirecting to login...</Typography>
    </Box>
  );
};
