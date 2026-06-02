'use client';

import React from 'react';
import { TextField } from './material';

export type DatePickerProps = {
  label?: React.ReactNode;
  value?: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  slotProps?: {
    textField?: Record<string, unknown>;
  };
};

export type DateTimePickerProps = DatePickerProps;

export const LocalizationProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export class AdapterDateFns {}

function formatDateValue(value: string | null | undefined, withTime: boolean) {
  if (!value) return '';
  if (value instanceof Date) {
    return withTime ? value.toISOString().slice(0, 16) : value.toISOString().slice(0, 10);
  }
  return value;
}

export const DatePicker = ({ label, value, onChange, disabled, minDate, maxDate, slotProps }: DatePickerProps) => (
  <TextField
    label={label}
    type="date"
    value={formatDateValue(value, false)}
    onChange={(event) => onChange?.(event.target.value || null)}
    disabled={disabled}
    min={minDate}
    max={maxDate}
    {...(slotProps?.textField ?? {})}
  />
);

export const DateTimePicker = ({ label, value, onChange, disabled, minDate, maxDate, slotProps }: DateTimePickerProps) => (
  <TextField
    label={label}
    type="datetime-local"
    value={formatDateValue(value, true)}
    onChange={(event) => onChange?.(event.target.value || null)}
    disabled={disabled}
    min={minDate}
    max={maxDate}
    {...(slotProps?.textField ?? {})}
  />
);
