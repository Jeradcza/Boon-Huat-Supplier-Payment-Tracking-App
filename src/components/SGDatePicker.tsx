import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { formatSGDate, toInputDateFormat } from '../utils/formatters';

interface SGDatePickerProps {
  value: string; // Accepts DD/MM/YYYY or YYYY-MM-DD
  onChange: (sgFormattedDate: string, rawIsoDate: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const SGDatePicker: React.FC<SGDatePickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY',
  disabled = false,
}) => {
  const [displayText, setDisplayText] = useState<string>(() => formatSGDate(value));
  const nativeDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(formatSGDate(value));
  }, [value]);

  const rawIsoValue = toInputDateFormat(value) || toInputDateFormat(displayText) || '';

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayText(val);

    // If valid DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split('/');
      const iso = `${y}-${m}-${d}`;
      onChange(val, iso);
    }
  };

  const handleTextBlur = () => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(displayText)) {
      setDisplayText(formatSGDate(value));
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoVal = e.target.value; // YYYY-MM-DD
    if (isoVal) {
      const sgFormatted = formatSGDate(isoVal);
      setDisplayText(sgFormatted);
      onChange(sgFormatted, isoVal);
    }
  };

  const openPicker = () => {
    if (disabled) return;
    if (nativeDateRef.current) {
      try {
        if ('showPicker' in nativeDateRef.current) {
          nativeDateRef.current.showPicker();
        } else {
          nativeDateRef.current.focus();
          nativeDateRef.current.click();
        }
      } catch {
        nativeDateRef.current.focus();
        nativeDateRef.current.click();
      }
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <input
        type="text"
        value={displayText}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        onClick={openPicker}
        placeholder={placeholder}
        disabled={disabled}
        className="w-36 px-3 py-1.5 pr-9 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 shadow-2xs cursor-pointer"
      />

      {/* Calendar Icon Button with Native Date Overlay */}
      <div 
        onClick={openPicker}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center cursor-pointer hover:text-blue-600 transition-colors"
        title="Click to open calendar date picker"
      >
        <CalendarIcon className="w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          ref={nativeDateRef}
          type="date"
          value={rawIsoValue}
          onChange={handleNativeDateChange}
          disabled={disabled}
          tabIndex={-1}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Select payment date (DD/MM/YYYY)"
        />
      </div>
    </div>
  );
};
