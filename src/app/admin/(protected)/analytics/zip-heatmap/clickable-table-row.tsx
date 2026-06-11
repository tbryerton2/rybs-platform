"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
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

  const shouldIgnoreClick = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target;

    if (!(target instanceof Element)) return false;
    if (target.closest("a, button, input, select, textarea, label, summary, [role='button'], [data-row-click-ignore='true']")) {
      return true;
    }

    const selection = window.getSelection();
    return Boolean(selection && selection.toString().trim().length > 0);
  };

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!href) return;
    if (shouldIgnoreClick(event)) return;
    handleActivate();
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
      onClick={href ? handleClick : undefined}
      onKeyDown={href ? handleKeyDown : undefined}
      className={className}
    >
      {children}
    </tr>
  );
}
