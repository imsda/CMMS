'use client';

import {useMemo, useState} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';

import {type AppLocale} from '../i18n';

type LanguageOption = {
  code: AppLocale;
  label: string;
};

const languageOptions: LanguageOption[] = [
  {code: 'en', label: '🇺🇸 EN'},
  {code: 'es', label: '🇪🇸 ES'}
];

export function LanguageSwitcher({currentLocale}: {currentLocale: AppLocale}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentOption = useMemo(
    () => languageOptions.find((option) => option.code === currentLocale) ?? languageOptions[0],
    [currentLocale]
  );

  const query = searchParams.toString();

  const onSelect = (locale: AppLocale) => {
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const localizedPath = pathname || '/';
    const href = query ? `${localizedPath}?${query}` : localizedPath;

    router.push(href);
    router.refresh();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {currentOption.label}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 min-w-[9rem] rounded-md border border-slate-200 bg-white p-1 shadow-md"
        >
          {languageOptions.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => onSelect(option.code)}
              className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              role="menuitem"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
