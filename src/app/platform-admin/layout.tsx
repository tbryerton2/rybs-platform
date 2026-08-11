export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PlatformAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="tcm-admin">{children}</div>;
}
