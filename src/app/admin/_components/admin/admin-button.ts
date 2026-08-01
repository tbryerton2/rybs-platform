export type AdminButtonVariant = "primary" | "secondary" | "destructive";
export type AdminButtonSize = "sm" | "md" | "lg";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function adminButtonClassName({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  iconOnly?: boolean;
  className?: string;
} = {}) {
  return joinClasses(
    "admin-btn",
    variant === "primary" && "admin-btn-primary",
    variant === "secondary" && "admin-btn-secondary",
    variant === "destructive" && "admin-btn-destructive",
    size === "sm" && "admin-btn-sm",
    size === "lg" && "admin-btn-lg",
    iconOnly && "admin-btn-icon",
    className,
  );
}
