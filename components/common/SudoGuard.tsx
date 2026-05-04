"use client";

import React, { useEffect, useState } from "react";
import { useSudo } from "@/context/SudoContext";
import { Box, Typography, Button, alpha } from "@mui/material";
import { Shield } from "lucide-react";

interface SudoGuardProps {
    children: React.ReactNode;
}

export default function SudoGuard({ children }: SudoGuardProps) {
    const { requestSudo, isUnlocked } = useSudo();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const handle = requestAnimationFrame(() => {
            setMounted(true);
        });
        return () => cancelAnimationFrame(handle);
    }, []);

    if (!mounted) return null;

    if (!isUnlocked) {
        return (
            <Box
                sx={{
                    minHeight: "400px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                    textAlign: "center",
                    borderRadius: "24px",
                    bgcolor: "rgba(255, 255, 255, 0.02)",
                    border: "1px dashed rgba(255, 255, 255, 0.1)",
                }}
            >
                <Box
                    sx={{
                        p: 2,
                        borderRadius: "16px",
                        bgcolor: alpha("#6366F1", 0.1),
                        color: "var(--color-brand)",
                        mb: 3,
                        border: '1px solid ' + alpha("#6366F1", 0.2)
                    }}
                >
                    <Shield size={48} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, fontFamily: 'var(--font-clash)' }}>
                    Security Verification
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: "rgba(255, 255, 255, 0.5)", mb: 4, maxWidth: "300px" }}
                >
                    Flow requires a local unlock to access sensitive ecosystem state and encrypted task data.
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => requestSudo({ onSuccess: () => {} })}
                    sx={{
                        bgcolor: "var(--color-brand)",
                        color: "#fff",
                        fontWeight: 800,
                        px: 4,
                        py: 1.5,
                        borderRadius: "16px",
                        fontFamily: 'var(--font-clash)',
                        '&:hover': { bgcolor: alpha("#6366F1", 0.8) }
                    }}
                >
                    Unlock Flow
                </Button>
            </Box>
        );
    }

    return <>{children}</>;
}
