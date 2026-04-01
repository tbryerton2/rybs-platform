"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ClickableTableRow({
  href,
  ariaLabel,
  className,
  children,
}: {
  href?: string | null;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const handleActivate = () => {
    if (!href) return;
    router.push(href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!href) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  };

  return (
    <tr
      tabIndex={href ? 0 : undefined}
      role={href ? "link" : undefined}
      aria-label={href ? ariaLabel : undefined}
      onClick={href ? handleActivate : undefined}
      onKeyDown={href ? handleKeyDown : undefined}
      className={className}
    >
      {children}
    </tr>
  );
}
