import { Bot, Check, Loader2, Send, Sparkles } from "lucide-react"
import { type FormEvent, useRef, useState } from "react"

import { type AvatarPublic, OpenAPI } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type ChatMessage = { role: "user" | "assistant"; content: string }
type Draft = {
  name: string
  description: string
  visual_prompt: string
  image_url: string | null
  image_key: string | null
}

type Props = {
  avatar?: AvatarPublic
  onSaved: (avatar: AvatarPublic) => void
}

function draftForAvatar(avatar?: AvatarPublic): Draft {
  return {
    name: avatar?.name ?? "",
    description: avatar?.description ?? "",
    visual_prompt: "",
    image_url: avatar?.image_url ?? null,
    image_key: null,
  }
}

function resizeInput(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto"
  textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
}

async function assistantRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(
    `${OpenAPI.BASE}/api/v1/avatar-assistant/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
      },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) {
    const responseText = await response.text()
    let detail = ""
    try {
      const error = JSON.parse(responseText)
      detail = typeof error.detail === "string" ? error.detail : ""
    } catch {
      detail = responseText
    }
    throw new Error(
      detail ||
        `The avatar assistant could not complete that request (${response.status})`,
    )
  }
  return response.json()
}

export function AvatarAssistant({ avatar, onSaved }: Props) {
  const mode = avatar ? "edit" : "create"
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState<Draft>(() => draftForAvatar(avatar))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || busy) return
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages(nextMessages)
    setInput("")
    if (inputRef.current) inputRef.current.style.height = "auto"
    setError(null)
    setBusy(true)
    try {
      const result = await assistantRequest<{ message: string; draft: Draft }>(
        "chat",
        {
          mode,
          avatar_id: avatar?.id ?? null,
          messages: nextMessages,
          draft,
        },
      )
      setDraft(result.draft)
      setMessages([
        ...nextMessages,
        { role: "assistant", content: result.message },
      ])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    setError(null)
    setBusy(true)
    try {
      const saved = await assistantRequest<AvatarPublic>("approve", {
        mode,
        avatar_id: avatar?.id ?? null,
        draft,
      })
      onSaved(saved)
      if (mode === "create") {
        setMessages([])
        setInput("")
        if (inputRef.current) inputRef.current.style.height = "auto"
        setDraft(draftForAvatar())
        setError(null)
      }
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(
    draft.name.trim() && draft.description.trim() && draft.image_url,
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={avatar ? "outline" : "default"}>
          <Sparkles /> {avatar ? "Edit with AI" : "Create with AI"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-10">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="size-5 text-violet-500" /> Avatar Assistant
          </SheetTitle>
          <SheetDescription>
            Need help {avatar ? "editing" : "making"} an avatar? Describe the
            person and we’ll shape the image and profile together.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
          <div className="overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                {avatar
                  ? `Tell me what you want to change about ${avatar.name}. You can update profile details, make a targeted image edit, or request a completely new image.`
                  : "Start with a name, profile facts, and a visual description. For example: “Her name is Maya, she’s 23 and from Austin, with curly dark hair and a casual creative style.”"}
              </div>
            )}
            <div className="mt-4 grid gap-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {message.content}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Working on the
                  draft…
                </div>
              )}
            </div>

            {(draft.name || draft.description || draft.image_url) && (
              <div className="mt-5 overflow-hidden rounded-xl border">
                {draft.image_url && (
                  <img
                    src={draft.image_url}
                    alt={draft.name || "Avatar draft"}
                    className="aspect-square w-full object-cover"
                  />
                )}
                <div className="grid gap-2 p-4">
                  <p className="font-semibold">
                    {draft.name || "Name not set"}
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {draft.description || "Profile details not set"}
                  </p>
                  <Button
                    className="mt-2"
                    disabled={!ready || busy}
                    onClick={approve}
                  >
                    <Check />{" "}
                    {avatar ? "Approve changes" : "Approve and create"}
                  </Button>
                  {!ready && (
                    <p className="text-xs text-muted-foreground">
                      A name, profile description, and image are required before
                      approval.
                    </p>
                  )}
                </div>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>

          <form
            className="flex gap-2 border-t bg-background p-4"
            onSubmit={send}
          >
            <textarea
              ref={inputRef}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 max-h-40 flex-1 resize-none overflow-y-auto rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              value={input}
              onChange={(event) => {
                setInput(event.target.value)
                resizeInput(event.currentTarget)
              }}
              placeholder="Describe your avatar or request a change…"
              rows={2}
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || busy}
              aria-label="Send message"
            >
              <Send />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
