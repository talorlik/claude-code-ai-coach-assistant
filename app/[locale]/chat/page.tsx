import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { requireClient } from "@/lib/auth/require-user"
import { listChatMessages } from "@/lib/db/chat-messages"
import type { Locale } from "@/i18n/routing"
import { ChatClient, type ChatInitialMessage } from "./chat-client"

/**
 * The chat is a private, per-user surface; keep it out of search indexes. The
 * visible title is localized via the `Chat` namespace; this metadata title is a
 * stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "AI Coach",
  robots: { index: false, follow: false },
}

/**
 * Localized AI virtual-trainer chat page at `/[locale]/chat`. `requireClient()`
 * is the authoritative guard (the `/chat` layout also guards the subtree);
 * signed-out visitors are redirected to the localized login page before any
 * content renders. The client's persisted chat history is loaded server-side and
 * handed to the interactive {@link ChatClient} as the initial transcript, so the
 * conversation survives reloads. The active locale is passed through so the chat
 * route can answer in the client's language.
 *
 * @param params - The dynamic route params carrying the active locale.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale)

  // Authoritative auth guard; redirects (locale-preserving) when signed out.
  const userId = await requireClient()

  const history = await listChatMessages(userId)
  const t = await getTranslations("Chat")

  const initialMessages: ChatInitialMessage[] = history.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
  }))

  return (
    <ChatClient
      locale={locale}
      initialMessages={initialMessages}
      labels={{
        title: t("title"),
        empty: t("empty"),
        thinking: t("thinking"),
        error: t("error"),
        placeholder: t("placeholder"),
        send: t("send"),
      }}
    />
  )
}
