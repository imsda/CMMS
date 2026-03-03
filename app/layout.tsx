import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations} from 'next-intl/server';

import {LanguageSwitcher} from '../components/language-switcher';
import {auth, signOut} from '../auth';
import {routing, type AppLocale} from '../i18n';

import './globals.css';

const inter = Inter({subsets: ['latin']});

export const metadata: Metadata = {
  title: 'Iowa-Missouri Club Management',
  description:
    'Conference-wide platform for yearly roster management, event registration, and class scheduling.'
};

function getLocaleFromCookie(cookieLocale: string | undefined): AppLocale {
  if (cookieLocale && routing.locales.includes(cookieLocale as AppLocale)) {
    return cookieLocale as AppLocale;
  }

  return routing.defaultLocale;
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const locale = getLocaleFromCookie((await cookies()).get('NEXT_LOCALE')?.value);
  const messages = await getMessages({locale});

  const tCommon = await getTranslations({locale, namespace: 'Common'});
  const tAuth = await getTranslations({locale, namespace: 'Auth'});

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="min-h-screen bg-slate-50">
            <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                    {tCommon('conference')}
                  </p>
                  <h1 className="text-lg font-semibold text-slate-900">{tCommon('platformTitle')}</h1>
                </div>

                <div className="flex items-center gap-3">
                  <LanguageSwitcher currentLocale={locale} />

                  {isLoggedIn ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{session?.user.name}</p>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {session?.user.role.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <form
                        action={async () => {
                          'use server';
                          await signOut({redirectTo: `/${locale}/login`});
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                        >
                          {tAuth('signOut')}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <Link
                      href={`/${locale}/login`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                    >
                      {tAuth('signIn')}
                    </Link>
                  )}
                </div>
              </div>
            </header>
            <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
