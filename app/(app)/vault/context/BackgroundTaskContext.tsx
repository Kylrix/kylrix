"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Box, Typography, LinearProgress, Button, alpha, CircularProgress } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import { FloatingContainer } from "@/components/ui/FloatingContainer";
import { ImportService, type ImportProgress, type ImportResult } from "@/utils/import/import-service";

interface BackgroundTaskContextType {
  startImport: (type: string, data: string, userId: string) => Promise<void>;
  isImporting: boolean;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextType | undefined>(undefined);

export function useBackgroundTask() {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    throw new Error("useBackgroundTask must be used within a BackgroundTaskProvider");
  }
  return context;
}

export function BackgroundTaskProvider({ children }: { children: ReactNode }) {
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showWidget, setShowWidget] = useState(false);

  const startImport = useCallback(async (type: string, data: string, userId: string) => {
    console.log("[BackgroundTask] startImport called:", { type, dataLength: data.length, userId });

    setIsImporting(true);
    setShowWidget(true);
    setImportProgress(null);
    setImportResult(null);

    try {
      let result: ImportResult;

      // Attempt server-side import first (bypasses rate limits)
      let serverResult: any = null;
      try {
        const { porterImport } = await import("@/lib/data-porter");
        const parsedData = JSON.parse(data);

        setImportProgress({
          stage: "credentials",
          currentStep: 2,
          totalSteps: 4,
          message: "Importing via server (bypassing rate limits)...",
          itemsProcessed: 0,
          itemsTotal: 0,
          errors: [],
        });

        serverResult = await porterImport(userId, type as 'bitwarden' | 'kylrixvault', parsedData);
        console.log("[BackgroundTask] Server-side import succeeded:", serverResult.summary);
      } catch (porterError: unknown) {
        console.warn("[BackgroundTask] Server-side import unavailable, falling back to client-side:", (porterError as Error).message);
        serverResult = null;
      }

      if (serverResult) {
        // Server-side succeeded
        result = {
          success: serverResult.success,
          summary: serverResult.summary,
          errors: serverResult.errors || [],
          folderMapping: new Map(),
        };
      } else {
        // Fallback: Client-side import
        const service = new ImportService((progress) => {
          setImportProgress(progress);
        });

        if (type === "bitwarden") {
          result = await service.importBitwardenData(data, userId);
        } else if (type === "kylrixvault") {
          console.log("[BackgroundTask] Calling importKylrixVaultData (client-side fallback)...");
          result = await service.importKylrixVaultData(data, userId);
          console.log("[BackgroundTask] importKylrixVaultData returned:", result.summary);
        } else {
          throw new Error("Unsupported import type");
        }
      }

      setImportResult(result);
    } catch (error: unknown) {
      console.error("Import failed ungracefully:", error);
      setImportResult({
        success: false,
        summary: {
          foldersCreated: 0,
          credentialsCreated: 0,
          totpSecretsCreated: 0,
          errors: 1,
          skipped: 0,
          skippedExisting: 0
        },
        errors: [(error as Error).message || "Unknown error"],
        folderMapping: new Map(),
      });
    } finally {
      setIsImporting(false);
    }
  }, []);

  const closeWidget = () => {
    if (isImporting) {
      if (!confirm("Import is in progress. Are you sure you want to hide the widget? The import will continue in the background.")) {
        return;
      }
    }
    setShowWidget(false);
    // Reset state if finished
    if (!isImporting) {
      setImportProgress(null);
      setImportResult(null);
    }
  };

  return (
    <BackgroundTaskContext.Provider value={{ startImport, isImporting }}>
      {children}
      {showWidget && (
        <FloatingContainer
          title={isImporting ? "Importing Data..." : "Import Complete"}
          onClose={closeWidget}
          defaultPosition={
            typeof window !== "undefined"
              ? { x: window.innerWidth - 340, y: window.innerHeight - 400 }
              : { x: 20, y: 20 }
          }
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!importResult ? (
              // Progress View
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {importProgress ? (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{importProgress.message}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {Math.round((importProgress.currentStep / importProgress.totalSteps) * 100)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(importProgress.currentStep / importProgress.totalSteps) * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        '& .MuiLinearProgress-bar': { borderRadius: 3 }
                      }}
                    />
                    {importProgress.itemsTotal > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Processed {importProgress.itemsProcessed} of {importProgress.itemsTotal} items
                      </Typography>
                    )}
                    <Box sx={{
                      p: 1.5,
                      borderRadius: '8px',
                      bgcolor: 'rgba(255, 193, 7, 0.05)',
                      border: '1px solid rgba(255, 193, 7, 0.1)'
                    }}>
                      <Typography variant="caption" sx={{ color: '#FFC107', display: 'block' }}>
                        Please do not close this tab or disconnect your internet.
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress size={16} sx={{ color: '#6366F1' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>Initializing import...</Typography>
                  </Box>
                )}
              </Box>
            ) : (
              // Result View
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: importResult.success ? alpha('#6366F1', 0.1) : alpha('#FF4D4D', 0.1),
                  border: '1px solid',
                  borderColor: importResult.success ? alpha('#6366F1', 0.2) : alpha('#FF4D4D', 0.2),
                  color: importResult.success ? '#6366F1' : '#FF4D4D'
                }}>
                  {importResult.success ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : <WarningIcon sx={{ fontSize: 20 }} />}
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {importResult.success ? "Import Successful" : "Import Failed"}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>Credentials: {importResult.summary.credentialsCreated}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>Folders: {importResult.summary.foldersCreated}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>TOTP Secrets: {importResult.summary.totpSecretsCreated}</Typography>
                  {importResult.summary.skippedExisting > 0 && (
                    <Typography variant="caption" sx={{ color: '#FFC107' }}>Skipped (Existing): {importResult.summary.skippedExisting}</Typography>
                  )}
                  {importResult.summary.errors > 0 && (
                    <Typography variant="caption" sx={{ color: '#FF4D4D', fontWeight: 600 }}>Errors: {importResult.summary.errors}</Typography>
                  )}
                </Box>

                {importResult.errors.length > 0 && (
                  <Box sx={{
                    maxHeight: 100,
                    overflowY: 'auto',
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor: alpha('#FF4D4D', 0.05),
                    border: '1px solid rgba(255, 77, 77, 0.1)'
                  }}>
                    {importResult.errors.map((e, i) => (
                      <Typography key={i} variant="caption" sx={{ color: '#FF4D4D', display: 'block' }}>• {e}</Typography>
                    ))}
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={closeWidget}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 700,
                    bgcolor: '#6366F1',
                    color: '#000',
                    '&:hover': { bgcolor: '#00D1DA' }
                  }}
                >
                  Close
                </Button>
              </Box>
            )}
          </Box>
        </FloatingContainer>
      )}
    </BackgroundTaskContext.Provider>
  );
}

