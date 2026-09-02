'use client';

import React from 'react';
import { UnifiedProfileView, type UnifiedProfileViewProps } from './UnifiedProfileView';

export interface ProfileProps extends UnifiedProfileViewProps {
  username: string;
  initialProfile?: any;
}

export function ProfileRedesign({ username, initialProfile, ...rest }: ProfileProps) {
  return (
    <UnifiedProfileView
      username={username}
      initialProfile={initialProfile}
      {...rest}
    />
  );
}

export const Profile = ProfileRedesign;
export default ProfileRedesign;
