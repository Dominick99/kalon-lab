import { Appearance } from "@/components/Common/Appearance"
import { AvatarShowcase } from "@/components/Common/AvatarShowcase"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
  showcase?: boolean
}

export function AuthLayout({ children, showcase = false }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-muted dark:bg-zinc-900 relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-6">
        <Logo
          variant="full"
          className={
            showcase ? "h-auto w-56 max-w-[60%]" : "h-auto w-80 max-w-[70%]"
          }
          asLink={false}
        />
        {showcase && <AvatarShowcase />}
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-end">
          <Appearance />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
        <Footer />
      </div>
    </div>
  )
}
