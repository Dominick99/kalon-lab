import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

const profiles = [
  {
    name: "Andrea Lopez",
    details: ["18 · Denver, Colorado", "Nursing student at MSU Denver"],
    image: "/assets/images/login-avatars/andrea.webp",
  },
  {
    name: "Holly McMillan",
    details: [
      "18 · Albuquerque, New Mexico",
      "UNM student · Originally from Austin",
    ],
    image: "/assets/images/login-avatars/holly.webp",
  },
  {
    name: "Madeline Swortz",
    details: ["21 · Ohio", "Accounting major at Ohio State"],
    image: "/assets/images/login-avatars/madeline.webp",
  },
]

const ROTATION_INTERVAL_MS = 4500
const EXIT_DURATION_MS = 500

export function AvatarShowcase() {
  const initialIndex = useMemo(
    () => Math.floor(Date.now() / 86_400_000) % profiles.length,
    [],
  )
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return

    let finishExit: number | undefined
    const rotation = window.setInterval(() => {
      setIsLeaving(true)
      finishExit = window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % profiles.length)
        setIsLeaving(false)
      }, EXIT_DURATION_MS)
    }, ROTATION_INTERVAL_MS)

    return () => {
      window.clearInterval(rotation)
      if (finishExit !== undefined) window.clearTimeout(finishExit)
    }
  }, [isPaused, prefersReducedMotion])

  const orderedProfiles = profiles.map(
    (_, offset) => profiles[(activeIndex + offset) % profiles.length],
  )

  return (
    <section
      className="relative h-[min(58vh,30rem)] w-[min(21rem,72%)]"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      aria-label="Featured avatar profiles"
    >
      {orderedProfiles.map((profile, position) => {
        const transforms = [
          "translateY(0) scale(1) rotate(0deg)",
          "translateY(0.75rem) scale(0.96) rotate(-2deg)",
          "translateY(1.5rem) scale(0.92) rotate(2deg)",
        ]
        const leavingTransform =
          "translateX(115%) translateY(-0.5rem) scale(0.98) rotate(10deg)"

        return (
          <article
            key={profile.name}
            className={cn(
              "bg-card text-card-foreground absolute inset-0 flex overflow-hidden rounded-2xl border shadow-xl",
              "transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none",
            )}
            style={{
              zIndex: profiles.length - position,
              opacity:
                position === 0 ? (isLeaving ? 0 : 1) : 1 - position * 0.2,
              transform:
                position === 0 && isLeaving
                  ? leavingTransform
                  : transforms[position],
            }}
            aria-hidden={position !== 0}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <img
                src={profile.image}
                alt={profile.name}
                className="min-h-0 flex-1 bg-black/5 object-contain dark:bg-black/20"
              />
              <div className="shrink-0 border-t px-5 py-4">
                <h2 className="truncate text-lg font-semibold">
                  {profile.name}
                </h2>
                <div className="text-muted-foreground mt-1 space-y-0.5 text-sm">
                  {profile.details.map((detail) => (
                    <p key={detail} className="truncate">
                      {detail}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}
