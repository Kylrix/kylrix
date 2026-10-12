'use client';

import React from 'react';
import { UnifiedProfileView, type UnifiedProfileViewProps } from '@/components/profile/UnifiedProfileView';

export interface ProfilePreviewDrawerProps extends UnifiedProfileViewProps {
  isOpen?: boolean;
}

export function ProfilePreviewDrawer(props: ProfilePreviewDrawerProps) {
  return <UnifiedProfileView {...props} />;
}
