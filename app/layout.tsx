import type {Metadata} from 'next';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations} from 'next-intl/server';

import {LanguageSwitcher} from '../components/language-switcher';
import {auth, signOut} from '../auth';
import {getLocaleFromCookie} from '../lib/locale';

import './globals.css';

export const metadata: Metadata = {
  title: 'Iowa-Missouri Club Management',
  description:
    'Conference-wide platform for yearly roster management, event registration, and class scheduling.'
};

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
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="app-shell">
            <header className="shell-header">
              <div className="flex items-center justify-between gap-6 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="hero-kicker">
                    {tCommon('conference')}
                  </p>
                  <h1 className="truncate text-xl font-semibold text-slate-950">{tCommon('platformTitle')}</h1>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <LanguageSwitcher currentLocale={locale} />

                  {isLoggedIn ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{session?.user.name}</p>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {session?.user.role.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <form
                        action={async () => {
                          'use server';
                          await signOut({redirectTo: `/login`});
                        }}
                      >
                        <button
                          type="submit"
                          className="btn-secondary"
                        >
                          {tAuth('signOut')}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <Link
                      href={`/login`}
                      className="btn-secondary"
                    >
                      {tAuth('signIn')}
                    </Link>
                  )}
                </div>
              </div>
            </header>
            <main className="shell-content">{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
