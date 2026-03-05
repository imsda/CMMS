import {defineRouting} from 'next-intl/routing';
import {getRequestConfig} from 'next-intl/server';

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: 'never'
});

export type AppLocale = (typeof routing.locales)[number];

export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;
  const requestedLocale =
    locale && routing.locales.includes(locale as AppLocale)
      ? (locale as AppLocale)
      : routing.defaultLocale;

  return {
    locale: requestedLocale,
    messages: (await import(`./messages/${requestedLocale}.json`)).default
  };
});
