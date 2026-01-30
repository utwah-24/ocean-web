import { useEffect, useMemo, useRef, useState } from 'react';

export type CountryOption = {
  iso2: string; // e.g. "TZ"
  dialCode: string; // e.g. "+255"
  name: string; // e.g. "Tanzania"
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { iso2: 'TZ', dialCode: '+255', name: 'Tanzania' },
  { iso2: 'US', dialCode: '+1', name: 'United States' },
  { iso2: 'GB', dialCode: '+44', name: 'United Kingdom' },
  { iso2: 'IN', dialCode: '+91', name: 'India' },
  { iso2: 'CN', dialCode: '+86', name: 'China' },
];

type ValueType = 'iso2' | 'dialCode';

function flagUrl(iso2: string) {
  return `https://flagcdn.com/24x18/${iso2.toLowerCase()}.png`;
}

export function CountryDropdown({
  value,
  valueType,
  onChange,
  options = COUNTRY_OPTIONS,
  ariaLabel,
}: {
  value: string;
  valueType: ValueType;
  onChange: (nextValue: string) => void;
  options?: CountryOption[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => {
    const found = options.find((o) => o[valueType] === value);
    return found ?? options[0];
  }, [options, value, valueType]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div ref={rootRef} className="country-code-dropdown country-dropdown-root">
      <button
        type="button"
        className="country-code-select country-dropdown-button"
        aria-label={ariaLabel ?? 'Select country'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="country-dropdown-button-content">
          <img
            className="country-flag"
            src={flagUrl(selected.iso2)}
            alt={selected.name}
            width={18}
            height={14}
            loading="lazy"
          />
          <span className="country-dial">{selected.dialCode}</span>
        </span>
      </button>

      {open && (
        <div className="country-dropdown-menu" role="listbox">
          {options.map((o) => {
            const isSelected = o.iso2 === selected.iso2;
            return (
              <button
                key={o.iso2}
                type="button"
                className={`country-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(o[valueType]);
                  setOpen(false);
                }}
              >
                <img
                  className="country-flag"
                  src={flagUrl(o.iso2)}
                  alt={o.name}
                  width={18}
                  height={14}
                  loading="lazy"
                />
                <span className="country-dial">{o.dialCode}</span>
                <span className="country-name">{o.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


