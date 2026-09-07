'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

import { AgenticPanelContentViewPart1 } from './AgenticPanelContentViewPart1';
import { AgenticPanelContentViewPart2 } from './AgenticPanelContentViewPart2';

export function AgenticPanelContentView(bag: any) {
  return (
    <>
      <AgenticPanelContentViewPart1 {...bag} />
      <AgenticPanelContentViewPart2 {...bag} />
    </>
  );
}
