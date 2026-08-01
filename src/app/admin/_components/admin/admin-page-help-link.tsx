import Link from "next/link";
import { BookOpenIcon } from "@heroicons/react/24/outline";

type AdminPageHelpLinkProps = {
  href: string;
  label?: string;
};

export function AdminPageHelpLink({
  href,
  label = "View guide",
}: AdminPageHelpLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-700"
    >
      <BookOpenIcon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
