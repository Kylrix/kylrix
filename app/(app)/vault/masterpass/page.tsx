"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppwriteVault } from "@/context/appwrite-context";
import { Box, CircularProgress, Typography } from "@mui/material";

/**
 * /masterpass - Master Password Management Page
 * Handles setup and reset of master password.
 * This route is for secure password management UI only.
 */
export default function MasterPassPage() {
  const router = useRouter();
  const { user, loading } = useAppwriteVault();

  useEffect(() => {
    // Security: Only authenticated users can access this route
    if (!loading && !user) {
      router.replace("/");
      return;
    }

    // Redirect to dashboard - masterpass management is handled via drawer
    // This route is reserved for future expansion if needed
    if (user && !loading) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "#0A0908",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
        Loading...
      </Typography>
    </Box>
  );
}

