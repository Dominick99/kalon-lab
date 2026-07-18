import { Link } from "@tanstack/react-router"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import icon from "/assets/images/fastapi-icon.svg"
import iconLight from "/assets/images/fastapi-icon-light.svg"
import sidebarLogo from "/assets/images/fastapi-logo.svg"
import sidebarLogoLight from "/assets/images/fastapi-logo-light.svg"
import kalonLabLogo from "/assets/images/kalon-lab-logo-transparent.png"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const responsiveLogo = isDark ? sidebarLogoLight : sidebarLogo
  const responsiveIcon = isDark ? iconLight : icon

  const content =
    variant === "responsive" ? (
      <>
        <img
          src={responsiveLogo}
          alt="Application logo"
          className={cn(
            "h-6 w-auto group-data-[collapsible=icon]:hidden",
            className,
          )}
        />
        <img
          src={responsiveIcon}
          alt="Application logo"
          className={cn(
            "size-5 hidden group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : (
      <img
        src={variant === "full" ? kalonLabLogo : responsiveIcon}
        alt={variant === "full" ? "Kalon Lab" : "Application logo"}
        className={cn(
          variant === "full"
            ? "h-6 w-auto object-contain"
            : "size-5 object-contain",
          className,
        )}
      />
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
