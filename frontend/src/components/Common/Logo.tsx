import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import kalonLabIcon from "/assets/images/kalon-lab-icon-transparent.png"
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
  const content =
    variant === "responsive" ? (
      <>
        <img
          src={kalonLabLogo}
          alt="Kalon Lab"
          className={cn(
            "h-20 w-auto max-w-full object-contain group-data-[collapsible=icon]:hidden",
            className,
          )}
        />
        <img
          src={kalonLabIcon}
          alt="Kalon Lab"
          className={cn(
            "size-8 hidden object-contain group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : (
      <img
        src={variant === "full" ? kalonLabLogo : kalonLabIcon}
        alt="Kalon Lab"
        className={cn(
          variant === "full"
            ? "h-6 w-auto object-contain"
            : "size-8 object-contain",
          className,
        )}
      />
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
