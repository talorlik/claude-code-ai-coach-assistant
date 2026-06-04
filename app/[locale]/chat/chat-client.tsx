"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatRole } from "@/lib/db/types"
import type { Locale } from "@/i18n/routing"

/** A persisted message hydrated into the initial transcript. */
export interface ChatInitialMessage {
  id: string
  role: ChatRole
  content: string
}

/** Localized, render-ready copy for the chat UI. */
export interface ChatLabels {
  title: string
  empty: string
  thinking: string
  error: string
  placeholder: string
  send: string
}

/** Reads the concatenated text of a UI message's text parts. */
function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

/**
 * Interactive AI virtual-trainer chat. The transcript, model call, and message
 * persistence all live behind `/api/chat` (the server route is the trust
 * boundary); this component only renders messages and posts new ones. Persisted
 * history is seeded via `initialMessages`, so the conversation survives reloads,
 * and the active locale is sent with every turn so the route can answer in the
 * client's language. Loading and error states are rendered from localized
 * `labels`; no user-facing copy is hard-coded here.
 *
 * @param locale - Active locale prefix, forwarded to the chat route per turn.
 * @param initialMessages - The persisted transcript to hydrate, oldest first.
 * @param labels - Localized UI copy.
 */
export function ChatClient({
  locale,
  initialMessages,
  labels,
}: {
  locale: Locale
  initialMessages: ChatInitialMessage[]
  labels: ChatLabels
}) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
    })),
  })

  const isStreaming = status === "streaming" || status === "submitted"

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    // Forward the active locale so the route answers in the client's language.
    sendMessage({ text }, { body: { locale } })
    setInput("")
  }

  return (
    <div className="mx-auto flex h-svh max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-5 w-5 text-primary" />
        {labels.title}
      </header>

      <ScrollArea className="flex-1 rounded-lg border p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {labels.empty}
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <Card
                  size="sm"
                  className={
                    message.role === "user"
                      ? "max-w-[80%] bg-primary text-primary-foreground"
                      : "max-w-[80%]"
                  }
                >
                  <CardContent className="whitespace-pre-wrap">
                    {textOf(message)}
                  </CardContent>
                </Card>
              </div>
            ))
          )}
          {isStreaming && (
            <p className="text-sm text-muted-foreground">{labels.thinking}</p>
          )}
          {error != null && (
            <p role="alert" className="text-sm text-destructive">
              {labels.error}
            </p>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={labels.placeholder}
          disabled={isStreaming}
          aria-label={labels.placeholder}
        />
        <Button type="submit" disabled={isStreaming || !input.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">{labels.send}</span>
        </Button>
      </form>
    </div>
  )
}
