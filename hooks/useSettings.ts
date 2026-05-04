'use client';

import { useState, useEffect } from 'react';

interface UserSettings {
  customGeminiKey?: string;
}

export const useSettings = () => {
  const [userSettings, setUserSettings] = useState<UserSettings>({});

  useEffect(() => {
    const storedSettings = localStorage.getItem('kylrixflow-settings');
    if (!storedSettings) return;

    try {
      const parsed = JSON.parse(storedSettings);
      // Only update if it's different to avoid cycles
      if (JSON.stringify(parsed) !== JSON.stringify(userSettings)) {
        requestAnimationFrame(() => {
          setUserSettings(parsed);
        });
      }
    } catch (err: unknown) {
      console.error('Failed to parse settings', err);
    }
  }, [userSettings]);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setUserSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('kylrix_settings', JSON.stringify(updated));
      return updated;
    });
  };

  return { userSettings, updateSettings };
};
