import { AdminToastProvider } from "./_components/admin/admin-toast-provider";
import { AdminShell } from "./_components/admin/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminToastProvider />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
