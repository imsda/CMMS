import { routing, type AppLocale } from "../i18n";

export function getLocaleFromCookie(cookieLocale: string | undefined): AppLocale {
  if (cookieLocale && routing.locales.includes(cookieLocale as AppLocale)) {
    return cookieLocale as AppLocale;
  }

  return routing.defaultLocale;
}
