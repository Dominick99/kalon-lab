import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Eye, ImagePlus, Plus } from "lucide-react"
import { type FormEvent, useState } from "react"

import { AvatarsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/avatars")({
  component: AvatarsPage,
  head: () => ({ meta: [{ title: "Avatars" }] }),
})

function CreateAvatar() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const mutation = useMutation({
    mutationFn: ({
      name,
      description,
      image,
    }: {
      name: string
      description: string
      image: File
    }) =>
      AvatarsService.createAvatar({
        formData: {
          name,
          description: description || null,
          image: image as unknown as string,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Avatar created")
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["avatars"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      name: String(data.get("name")),
      description: String(data.get("description") ?? ""),
      image: data.get("image") as File,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New avatar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an AI avatar</DialogTitle>
          <DialogDescription>
            Add an image, name, and description.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="avatar-name">Name</Label>
            <Input id="avatar-name" name="name" required maxLength={255} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="avatar-description">Description</Label>
            <Input
              id="avatar-description"
              name="description"
              maxLength={2000}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="avatar-image">Image</Label>
            <Input
              id="avatar-image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </div>
          <LoadingButton type="submit" loading={mutation.isPending}>
            Save avatar
          </LoadingButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AvatarsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["avatars"],
    queryFn: () => AvatarsService.readAvatars({ limit: 100 }),
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Avatars</h1>
          <p className="text-muted-foreground">
            Create and manage your characters
          </p>
        </div>
        <CreateAvatar />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading avatars…</p>
      ) : data?.data.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ImagePlus className="mb-4 size-10 text-muted-foreground" />
          <h2 className="font-semibold">No avatars yet</h2>
          <p className="text-muted-foreground">
            Create your first AI avatar to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data?.data.map((avatar) => (
            <Card key={avatar.id} className="overflow-hidden pt-0">
              <img
                src={avatar.image_url}
                alt={avatar.name}
                className="aspect-square w-full object-cover"
              />
              <CardHeader>
                <CardTitle>{avatar.name}</CardTitle>
                <CardDescription>
                  {avatar.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Button className="w-full" asChild>
                  <Link to="/avatar/$avatarId" params={{ avatarId: avatar.id }}>
                    <Eye /> View avatar
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
