import type React from 'react';

/** OpenBricks select change event (replaces legacy MUI SelectChangeEvent). */
export type ObSelectChangeEvent<T = string> = React.ChangeEvent<HTMLSelectElement> & {
  target: EventTarget & { value: T; name?: string };
};

/** @deprecated Use ObSelectChangeEvent */
export type SelectChangeEvent<T = string> = ObSelectChangeEvent<T>;
