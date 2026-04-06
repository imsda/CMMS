export function formatDateRange(startsAt: Date, endsAt: Date, locale: string) {
  return `${startsAt.toLocaleDateString(locale)} - ${endsAt.toLocaleDateString(locale)}`;
}
