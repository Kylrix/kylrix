"use client";

import { useEffect, useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Shield, 
  Settings, 
  LogOut, 
  Home, 
  Share2, 
  Upload, 
  Lock 
} from "lucide-react";
import { 
  Button, 
  Box, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Divider, 
  Typography, 
  Paper,
  alpha
} from "@mui/material";
import { useAppwriteVault } from "@/context/appwrite-context";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import VaultTopbar from "@/components/common/VaultTopbar";
import BottomNav from "./BottomNav";
import { VaultFAB } from "./VaultFAB";
import dynamic from "next/dynamic";
import type { Models } from "appwrite";

const PasskeySetup = dynamic(() => import("@/components/overlays/passkeySetup").then(mod => mod.PasskeySetup), { ssr: false });

interface ExtendedUser extends Models.User<Models.Preferences> {
  isPasskey?: boolean;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, big: false },
  { name: "Sharing", href: "/sharing", icon: Share2, big: false },
  { name: "TOTP", href: "/totp", icon: Shield, big: false },
  { name: "Import", href: "/import", icon: Upload, big: false },
  { name: "Settings", href: "/settings", icon: Settings, big: false },
];

const SIMPLIFIED_LAYOUT_PATHS = [
  "/",
  "/twofa/access",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, logout, refresh } = useAppwriteVault();
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);

  const isEmbedded = useMemo(() => searchParams?.get('is_embedded') === 'true', [searchParams]);
  const isSimplifiedLayout = SIMPLIFIED_LAYOUT_PATHS.includes(pathname) || isEmbedded;

  useEffect(() => {
    if (user && !loading) {
      const extendedUser = user as ExtendedUser;
      const shouldEnforcePasskey =
        process.env.NEXT_PUBLIC_PASSKEY_ENFORCE === "true" && !extendedUser.isPasskey;
      if (shouldEnforcePasskey && masterPassCrypto.isVaultUnlocked()) {
        setShowPasskeySetup(true);
      }
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user && !isSimplifiedLayout) {
      router.replace("/dashboard");
    }
  }, [loading, user, isSimplifiedLayout, router]);

  useEffect(() => {
    if (user && !isSimplifiedLayout) {
      masterPassCrypto.updateActivity();
      let intervalId: number | undefined;

      const keepAlive = () => masterPassCrypto.updateActivity();

      const startWatcher = () => {
        clearInterval(intervalId as number);
        intervalId = window.setInterval(() => {
          if (!masterPassCrypto.isVaultUnlocked()) {
            sessionStorage.setItem("masterpass_return_to", pathname);
            router.replace("/dashboard");
            clearInterval(intervalId as number);
          }
        }, 1000);
      };

      const handleActivity = () => keepAlive();

      window.addEventListener("mousemove", handleActivity);
      window.addEventListener("mousedown", handleActivity);
      window.addEventListener("keydown", handleActivity);
      window.addEventListener("scroll", handleActivity, { passive: true });
      window.addEventListener("touchstart", handleActivity, { passive: true });
      window.addEventListener("focus", handleActivity);
      window.addEventListener("click", handleActivity);

      const handleVisibility = () => {
        if (!masterPassCrypto.isVaultUnlocked()) {
          sessionStorage.setItem("masterpass_return_to", pathname);
          router.replace("/dashboard");
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      startWatcher();

      if (!masterPassCrypto.isVaultUnlocked()) {
        sessionStorage.setItem("masterpass_return_to", pathname);
        router.replace("/dashboard");
      }

      return () => {
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("mousedown", handleActivity);
        window.removeEventListener("keydown", handleActivity);
        window.removeEventListener("scroll", handleActivity);
        window.removeEventListener("touchstart", handleActivity);
        window.removeEventListener("focus", handleActivity);
        window.removeEventListener("click", handleActivity);
        document.removeEventListener("visibilitychange", handleVisibility);
        clearInterval(intervalId as number);
      };
    }
  }, [user, isSimplifiedLayout, pathname, router]);

  useEffect(() => {
    const mood = isSimplifiedLayout || pathname?.startsWith('/totp') || pathname?.startsWith('/settings')
      ? 'serious'
      : 'ambient';
    document.body.dataset.uiMood = mood;
    return () => {
      document.body.dataset.uiMood = 'ambient';
    };
  }, [isSimplifiedLayout, pathname]);

  if (isSimplifiedLayout) {
    return <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background)' }}>{children}</Box>;
  }

  if (!loading && !user) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background)', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <VaultTopbar />

      <Box sx={{ flex: 1, display: 'flex', width: '100%', overflowX: 'hidden', pt: '88px' }}>
        <Box
          component="aside"
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'fixed',
            left: 0,
            top: 72,
            height: 'calc(100vh - 72px)',
            width: 280,
             bgcolor: 'var(--color-surface)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            overflowY: 'auto',
            zIndex: 30,
            p: 3
          }}
          aria-label="Primary sidebar navigation"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <List sx={{ flex: 1, py: 0 }}>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <ListItem key={item.name} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      component={Link}
                      href={item.href}
                      sx={{
                        borderRadius: '14px',
                        bgcolor: isActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                        color: isActive ? '#10B981' : 'rgba(255, 255, 255, 0.5)',
                        border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          color: 'white'
                        },
                        py: item.big ? 2 : 1.2,
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                        <item.icon size={item.big ? 22 : 18} strokeWidth={1.5} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: isActive ? 800 : 600,
                          fontFamily: 'var(--font-space-grotesk)',
                          letterSpacing: '0.01em',
                          fontSize: '0.85rem'
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            
            <Box sx={{ mt: 'auto', pt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.03)', mb: 3 }} />
              

              <Button
                variant="text"
                fullWidth
                startIcon={<Lock size={16} strokeWidth={1.5} />}
                onClick={() => {
                  masterPassCrypto.lockNow();
                  if (!masterPassCrypto.isVaultUnlocked()) {
                    sessionStorage.setItem("masterpass_return_to", pathname);
                    router.replace("/dashboard");
                  }
                }}
                sx={{ 
                  justifyContent: 'flex-start', 
                  color: 'rgba(255, 255, 255, 0.4)',
                  borderRadius: '10px',
                  px: 2,
                  py: 1,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'white' }
                }}
              >
                Lock Vault
              </Button>

              <Button
                variant="text"
                fullWidth
                startIcon={<LogOut size={16} strokeWidth={1.5} />}
                onClick={logout}
                sx={{ 
                  justifyContent: 'flex-start', 
                  color: 'rgba(255, 77, 77, 0.6)',
                  borderRadius: '10px',
                  px: 2,
                  py: 1,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { bgcolor: alpha('#FF4D4D', 0.05), color: '#FF4D4D' }
                }}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden', ml: { lg: '280px' } }}>
          <Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 4, md: 8 }, py: 6, pb: { xs: 12, lg: 6 }, overflowX: 'hidden', maxWidth: '100%' }}>
            {children}
          </Box>
        </Box>
      </Box>

      {/* Mobile Bottom Navigation - Floating Kylrix Style */}
      <Paper
        component="nav"
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          right: 24,
          zIndex: 50,
           bgcolor: 'var(--color-surface)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          display: { xs: 'flex', lg: 'none' },
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 72,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          overflow: 'visible'
        }}
      >
        {navigation
          .filter((item) => item.name !== "Import")
          .map((item) => {
            const isActive = pathname === item.href;
            const isBig = item.big;

            if (isBig) {
              return (
                <Box
                  key={item.name}
                  component={Link}
                  href={item.href}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mt: -6,
                    textDecoration: 'none',
                    zIndex: 2
                  }}
                >
                  <Box
                    sx={{
                      height: 60,
                      width: 60,
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#10B981',
                      color: '#000',
                      boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                      border: '4px solid #000',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:active': { transform: 'scale(0.9) translateY(4px)' }
                    }}
                  >
                    <item.icon size={28} strokeWidth={2} />
                  </Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      mt: 0.5,
                      color: isActive ? '#10B981' : 'rgba(255, 255, 255, 0.6)',
                      fontFamily: 'var(--font-space-grotesk)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {item.name}
                  </Typography>
                </Box>
              );
            }

            return (
              <Box
                key={item.name}
                component={Link}
                href={item.href}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                  minWidth: 64,
                  textDecoration: 'none',
                  color: isActive ? '#10B981' : 'rgba(255, 255, 255, 0.4)',
                  transition: 'all 0.2s ease',
                  '&:active': { transform: 'scale(0.9)' }
                }}
              >
                <item.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontSize: 10, 
                    fontWeight: isActive ? 800 : 600, 
                    mt: 0.5,
                    fontFamily: 'var(--font-space-grotesk)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    opacity: isActive ? 1 : 0.6
                  }}
                >
                  {item.name}
                </Typography>
              </Box>
            );
          })}
      </Paper>

      {user && (
        <>
          <VaultFAB />
          <BottomNav />
          <PasskeySetup
            isOpen={showPasskeySetup}
            onClose={() => setShowPasskeySetup(false)}
            userId={user.$id}
            isEnabled={false}
            onSuccess={() => {
              setShowPasskeySetup(false);
              refresh();
            }}
            trustUnlocked={true}
          />
        </>
      )}
    </Box>
  );
}
