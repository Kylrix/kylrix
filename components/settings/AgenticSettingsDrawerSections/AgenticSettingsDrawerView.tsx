'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 

import { AgenticSettingsDrawerViewPart1 } from './AgenticSettingsDrawerViewPart1';
import { AgenticSettingsDrawerViewPart2 } from './AgenticSettingsDrawerViewPart2';

export function AgenticSettingsDrawerView(bag: any) {
  return (
    <>
      <AgenticSettingsDrawerViewPart1 {...bag} />
      <AgenticSettingsDrawerViewPart2 {...bag} />
    </>
  );
}
