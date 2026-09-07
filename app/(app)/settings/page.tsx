'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { motion } from 'framer-motion';
import { 
    ArrowLeft, 
    Fingerprint,
    Trash2,
    RefreshCw,
    ChevronRight,
    Bot,
    Lightbulb,
    Loader2 as SpinnerIcon,
    Edit3,
    ShieldCheck as SecurityIcon,
    ShieldCheck,
    MonitorSmartphone as SessionsIcon,
    History as ActivityIcon,
    Sliders as PreferencesIcon,
    Settings2 as RootAccountIcon,
    ShieldAlert as AdminIcon,
    Code2 as DevelopersIcon,
    FolderKanban as WorkspaceIcon,
    CreditCard as BillingIcon,
    Users,
    Copy,
    Check,
    Download,
    AlertTriangle,
    ArrowUpDown,
} from 'lucide-react';
import { WorkspaceTab } from '@/components/settings/WorkspaceTab';
import { AgentsSettingsTab } from '@/components/settings/AgentsSettingsTab';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { PrivacyTab } from '@/components/settings/PrivacyTab';
import { DevelopersTab } from '@/components/settings/DevelopersTab';
import { useOpenEcosystemPorter } from '@/components/porter/useOpenEcosystemPorter';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { useSudo } from '@/context/SudoContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { UsersService } from '@/lib/services/users';
import { toast } from 'react-hot-toast';
import { TelegramDrawer } from '@/components/overlays/TelegramDrawer';
import { checkTelegramConnection } from '@/lib/actions/telegram';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useAppwriteVault } from '@/context/appwrite-context';
import { getUserProfilePicId, getEffectiveDisplayName, getEffectiveUsername } from '@/lib/utils';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { getComputeBalanceAction } from '@/lib/actions/ai';
import { getCachedProfilePreview } from '@/lib/profile-preview';
import { getUserProfilePicId as getSdkUserProfilePicId } from '@/lib/user-utils';
import { useSubscription } from '@/context/subscription/SubscriptionContext';

// Consolidated settings subpage imports
import SessionsManager from '@/components/SessionsManager';
import ActivityLogs from '@/components/ActivityLogs';
import ConnectedIdentities from '@/components/ConnectedIdentities';
import PreferencesManager from '@/components/PreferencesManager';
import { TwoFactorPanel } from '@/components/overlays/TwoFactorDrawer';
import { BillingDrawer, BillingContent } from '@/components/overlays/BillingDrawer';
import { account } from '@/lib/appwrite/client';
import AdminDashboardPage from '@/components/admin/AdminDashboard';
import UsersManagement from '@/components/admin/UsersManagement';
import EmailOrchestrator from '@/components/admin/EmailOrchestrator';
import AdminCouponsPage from '@/components/admin/AdminCoupons';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useNativeSidebarOptional } from '@/context/RightRailContext';
import { DeleteAccountFlow } from '@/components/settings/DeleteAccountFlow';
import { SettingsPageInner as SettingsPageInner_ext } from './pageSections/SettingsPageInner';


// Inline Custom Telegram Icon SVG for lucide alignment
function TelegramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.98-3.45 3.79-1.63 4.58-1.91 5.09-1.92.11 0 .36.03.52.16.14.12.18.28.2.43-.02.07-.02.16-.02.25z"/>
    </svg>
  );
}

// Reuseable custom Switch

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-[#0A0908]">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#6366F1]" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

const SettingsPageInner = (..._args: any[]) => SettingsPageInner_ext({ SettingsPageInner });
