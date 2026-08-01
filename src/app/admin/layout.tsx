export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="tcm-admin">{children}</div>;
}
