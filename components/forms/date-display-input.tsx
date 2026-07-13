'use client';

import {useState} from 'react';

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
  const [monthValue, setMonthValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(monthToDisplayDate(value));

  return (
    <>
      <input name={name} type="hidden" value={monthValue} />
      <input
        className={className}
        inputMode="numeric"
        onChange={(event) => {
          const nextDisplay = event.target.value;
          setDisplayValue(nextDisplay);
          const nextMonth = displayDateToMonth(nextDisplay);
          if (nextMonth) {
            setMonthValue(nextMonth);
            onMonthChange?.(nextMonth);
          } else if (!nextDisplay.trim()) {
            setMonthValue('');
            onMonthChange?.('');
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
