'use client';

import {useRef, useState} from 'react';

export function isoDateToDisplay(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

export function displayDateToIso(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, rawDay, rawMonth, year] = match;
  const day = rawDay.padStart(2, '0');
  const month = rawMonth.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthToDisplayDate(value: string) {
  const [year, month] = value.split('-');
  return year && month ? `01/${month}/${year}` : '';
}

export function displayDateToMonth(value: string) {
  const isoDate = displayDateToIso(value);
  return isoDate ? isoDate.slice(0, 7) : null;
}

function openNativePicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch {
    input.focus();
  }

  input.focus();
}

export function DateDisplayInput({
  className = '',
  defaultValue = '',
  name,
  onIsoChange,
  placeholder = '13/07/2026',
  required = false
}: {
  className?: string;
  defaultValue?: string;
  name: string;
  onIsoChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [isoValue, setIsoValue] = useState(defaultValue);
  const [displayValue, setDisplayValue] = useState(isoDateToDisplay(defaultValue));

  return (
    <>
      <input name={name} type="hidden" value={isoValue} />
      <span
        className={`${className} relative inline-flex cursor-pointer items-center overflow-hidden text-left`}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          openNativePicker(pickerRef.current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openNativePicker(pickerRef.current);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className={displayValue ? 'text-current' : 'text-[#8a9693]'}>{displayValue || placeholder}</span>
        <input
          aria-label={placeholder}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          max="9999-12-31"
          min="1900-01-01"
          onChange={(event) => {
            const nextIso = event.target.value;
            setIsoValue(nextIso);
            setDisplayValue(isoDateToDisplay(nextIso));
            onIsoChange?.(nextIso);
          }}
          ref={pickerRef}
          required={required}
          type="date"
          value={isoValue}
        />
      </span>
    </>
  );
}

export function MonthDisplayInput({
  className = '',
  name,
  onMonthChange,
  placeholder = '01/07/2026',
  required = false,
  value
}: {
  className?: string;
  name: string;
  onMonthChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [monthValue, setMonthValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(monthToDisplayDate(value));

  return (
    <>
      <input name={name} type="hidden" value={monthValue} />
      <span
        className={`${className} relative inline-flex cursor-pointer items-center overflow-hidden text-left`}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          openNativePicker(pickerRef.current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openNativePicker(pickerRef.current);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className={displayValue ? 'text-current' : 'text-[#8a9693]'}>{displayValue || placeholder}</span>
        <input
          aria-label={placeholder}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          max="9999-12"
          min="1900-01"
          onChange={(event) => {
            const nextMonth = event.target.value;
            setMonthValue(nextMonth);
            setDisplayValue(monthToDisplayDate(nextMonth));
            onMonthChange?.(nextMonth);
          }}
          ref={pickerRef}
          required={required}
          type="month"
          value={monthValue}
        />
      </span>
    </>
  );
}

export function TextDateInput({
  className = '',
  defaultValue = '',
  name,
  onIsoChange,
  placeholder = '13/07/2026',
  required = false
}: {
  className?: string;
  defaultValue?: string;
  name: string;
  onIsoChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [isoValue, setIsoValue] = useState(defaultValue);
  const [displayValue, setDisplayValue] = useState(isoDateToDisplay(defaultValue));

  return (
    <>
      <input name={name} type="hidden" value={isoValue} />
      <input
        className={className}
        inputMode="numeric"
        onChange={(event) => {
          const nextDisplay = event.target.value;
          setDisplayValue(nextDisplay);
          const nextIso = displayDateToIso(nextDisplay);
          if (nextIso) {
            setIsoValue(nextIso);
            onIsoChange?.(nextIso);
          } else if (!nextDisplay.trim()) {
            setIsoValue('');
            onIsoChange?.('');
          }
        }}
        pattern="\d{1,2}/\d{1,2}/\d{4}"
        placeholder={placeholder}
        required={required}
        value={displayValue}
      />
    </>
  );
}
