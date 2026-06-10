import type { ReactNode, SVGProps } from "react";

export const HOME_STATS_ICON_OPTIONS = [
  { key: "truck", label: "Truck" },
  { key: "home", label: "Home / family" },
  { key: "shield", label: "Shield" },
  { key: "clock", label: "Clock" },
  { key: "star", label: "Star" },
  { key: "mapPin", label: "Map pin" },
  { key: "calendar", label: "Calendar" },
  { key: "dollar", label: "Dollar" },
  { key: "tag", label: "Tag" },
  { key: "checkCircle", label: "Check circle" },
  { key: "phone", label: "Phone" },
  { key: "hardHat", label: "Hard hat" },
  { key: "container", label: "Container" },
] as const;

export type HomeStatsIconKey = (typeof HOME_STATS_ICON_OPTIONS)[number]["key"];

const HOME_STATS_ICON_KEYS = new Set<string>(HOME_STATS_ICON_OPTIONS.map((option) => option.key));

export function isHomeStatsIconKey(value: unknown): value is HomeStatsIconKey {
  return typeof value === "string" && HOME_STATS_ICON_KEYS.has(value);
}

export function normalizeHomeStatsIconKey(value: unknown): HomeStatsIconKey {
  return isHomeStatsIconKey(value) ? value : "truck";
}

export function getHomeStatsIconLabel(key: HomeStatsIconKey) {
  return HOME_STATS_ICON_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

type IconProps = SVGProps<SVGSVGElement>;

function IconSvg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function TruckIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M10 17H6.5" />
      <path d="M14 17h1.5" />
      <path d="M18.5 17H20a1 1 0 0 0 1-1v-4.5L18 7h-4v10" />
      <path d="M3 6h11v11H3z" />
      <path d="M14 11h5" />
      <circle cx="5" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </IconSvg>
  );
}

function HomeIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10.5V21h6v-5h2v5h6V10.5" />
      <path d="M16.4 14.7c.8-.9 2.4-.3 2.4 1 0 1.5-2.4 2.8-2.4 2.8S14 17.2 14 15.7c0-1.3 1.6-1.9 2.4-1Z" />
    </IconSvg>
  );
}

function ShieldIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </IconSvg>
  );
}

function ClockIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconSvg>
  );
}

function StarIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="m12 2 3 6 6.5 1-4.7 4.6 1.1 6.4L12 17l-5.9 3 1.1-6.4L2.5 9 9 8l3-6Z" />
    </IconSvg>
  );
}

function MapPinIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </IconSvg>
  );
}

function CalendarIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </IconSvg>
  );
}

function DollarIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </IconSvg>
  );
}

function TagIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M12.6 2.6H5a2 2 0 0 0-2 2v7.6a2 2 0 0 0 .6 1.4l6.8 6.8a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8L13.9 3.2a2 2 0 0 0-1.3-.6Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </IconSvg>
  );
}

function CheckCircleIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </IconSvg>
  );
}

function PhoneIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" />
    </IconSvg>
  );
}

function HardHatIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M3 18h18" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <path d="M9 10v5" />
      <path d="M15 10v5" />
      <path d="M10 6.4a7.3 7.3 0 0 1 4 0" />
      <path d="M6 21h12" />
    </IconSvg>
  );
}

function ContainerIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <rect x="3" y="7" width="18" height="11" rx="1.5" />
      <path d="M7 7v11" />
      <path d="M11 7v11" />
      <path d="M15 7v11" />
      <path d="M19 7v11" />
      <path d="M3 11h18" />
    </IconSvg>
  );
}

const HOME_STATS_ICONS: Record<HomeStatsIconKey, (props: IconProps) => ReactNode> = {
  truck: TruckIcon,
  home: HomeIcon,
  shield: ShieldIcon,
  clock: ClockIcon,
  star: StarIcon,
  mapPin: MapPinIcon,
  calendar: CalendarIcon,
  dollar: DollarIcon,
  tag: TagIcon,
  checkCircle: CheckCircleIcon,
  phone: PhoneIcon,
  hardHat: HardHatIcon,
  container: ContainerIcon,
};

export function HomeStatsIcon({
  iconKey,
  ...props
}: IconProps & {
  iconKey: HomeStatsIconKey;
}) {
  const Icon = HOME_STATS_ICONS[iconKey];
  return <Icon {...props} />;
}
