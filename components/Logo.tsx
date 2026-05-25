'use client';

import React from 'react';
import LogoComponent from './common/Logo';
import { KylrixApp } from '@/lib/sdk';

interface LogoProps {
  sx?: any;
  size?: number;
  app?: KylrixApp;
  variant?: 'full' | 'icon';
  component?: any;
  href?: string;
  animate?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = (props) => {
  return <LogoComponent {...props} />;
};

export default Logo;
export { Logo };
export type { KylrixApp };
