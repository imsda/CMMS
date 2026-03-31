"use client";

import { useState } from "react";

type ShareEventButtonProps = {
  eventSlug: string;
};

export function ShareEventButton({ eventSlug }: ShareEventButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/events#${eventSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn-secondary"
    >
      {copied ? "URL Copied!" : "Share Event"}
    </button>
  );
}
