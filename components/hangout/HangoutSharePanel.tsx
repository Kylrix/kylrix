'use client';

import React from 'react';
import { HangoutsDrawer, type ShareObject } from './HangoutsDrawer';

export function HangoutSharePanel({
  object,
  onClose,
}: {
  object: ShareObject;
  onClose?: () => void;
}) {
  return <HangoutsDrawer mode="share" object={object} onClose={onClose} />;
}
