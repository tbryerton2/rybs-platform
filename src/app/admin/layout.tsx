import { AdminToastProvider } from "./_components/admin/admin-toast-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminToastProvider />
      {children}
    </>
  );
}