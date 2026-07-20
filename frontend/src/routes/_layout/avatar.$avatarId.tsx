import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, CalendarDays, ImagePlus, Save, Trash2 } from "lucide-react"
import type { FormEvent } from "react"

import { AvatarsService } from "@/client"
import { AvatarAssistant } from "@/components/Avatars/AvatarAssistant"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/avatar/$avatarId")({
  component: AvatarProfilePage,
  head: () => ({ meta: [{ title: "Avatar profile" }] }),
})

function AvatarProfilePage() {
  const { avatarId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: avatar, isLoading } = useQuery({
    queryKey: ["avatars", avatarId],
    queryFn: () => AvatarsService.readAvatar({ id: avatarId }),
  })
  const update = useMutation({
    mutationFn: ({
      name,
      description,
    }: {
      name: string
      description: string
    }) =>
      AvatarsService.updateAvatar({
        id: avatarId,
        requestBody: { name, description: description || null },
      }),
    onSuccess: () => {
      showSuccessToast("Avatar details updated")
      queryClient.invalidateQueries({ queryKey: ["avatars"] })
    },
    onError: handleError.bind(showErrorToast),
  })
  const replace = useMutation({
    mutationFn: (image: File) =>
      AvatarsService.replaceAvatarImage({
        id: avatarId,
        formData: { image: image as unknown as string },
      }),
    onSuccess: () => {
      showSuccessToast("Avatar image replaced")
      queryClient.invalidateQueries({ queryKey: ["avatars"] })
    },
    onError: handleError.bind(showErrorToast),
  })
  const remove = useMutation({
    mutationFn: () => AvatarsService.deleteAvatar({ id: avatarId }),
    onSuccess: () => {
      showSuccessToast("Avatar deleted")
      queryClient.invalidateQueries({ queryKey: ["avatars"] })
      navigate({ to: "/avatars" })
    },
    onError: handleError.bind(showErrorToast),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    update.mutate({
      name: String(data.get("name")),
      description: String(data.get("description") ?? ""),
    })
  }

  if (isLoading || !avatar)
    return <p className="text-muted-foreground">Loading avatar…</p>

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" className="w-fit" asChild>
          <Link to="/avatars">
            <ArrowLeft /> Back to avatars
          </Link>
        </Button>
        <AvatarAssistant
          key={`${avatar.id}-${avatar.updated_at}`}
          avatar={avatar}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["avatars"] })
            queryClient.invalidateQueries({ queryKey: ["avatars", avatarId] })
          }}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-32 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-sky-500/30 sm:h-44" />
        <div className="px-6 pb-6 sm:px-10">
          <div className="-mt-16 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end">
            <img
              src={avatar.image_url}
              alt={avatar.name}
              className="size-32 rounded-2xl border-4 border-card bg-muted object-cover shadow-md sm:size-40"
            />
            <div className="min-w-0 flex-1 pb-2">
              <h1 className="truncate text-3xl font-bold tracking-tight">
                {avatar.name}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {avatar.description || "No description yet"}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4" /> Created{" "}
                {new Date(avatar.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={avatar.name}
                  required
                  maxLength={255}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={avatar.description ?? ""}
                  maxLength={2000}
                />
              </div>
              <LoadingButton
                className="w-fit"
                type="submit"
                loading={update.isPending}
              >
                <Save /> Save changes
              </LoadingButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile image</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Label className="cursor-pointer">
                  <ImagePlus /> Replace image
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const image = event.target.files?.[0]
                      if (image) replace.mutate(image)
                    }}
                  />
                </Label>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Permanently delete this avatar and its image.
              </p>
              <LoadingButton
                variant="destructive"
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                <Trash2 /> Delete avatar
              </LoadingButton>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
