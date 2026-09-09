'use client';

import React from 'react';
import { UnifiedProfileView, type UnifiedProfileViewProps } from './UnifiedProfileView';

export interface ProfileProps extends UnifiedProfileViewProps {
  username: string;
  initialProfile?: any;
}

export function Profile({ username, initialProfile, ...rest }: ProfileProps) {
  return (
    <UnifiedProfileView
      username={username}
      initialProfile={initialProfile}
      {...rest}
    />
  );
}
