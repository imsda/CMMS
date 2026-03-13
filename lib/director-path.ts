export function buildDirectorPath(pathname: string, clubId: string, isSuperAdmin: boolean) {
  if (!isSuperAdmin) {
    return pathname;
  }

  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}clubId=${encodeURIComponent(clubId)}`;
}

export function readManagedClubId(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
