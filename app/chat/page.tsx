"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="mx-auto flex h-svh max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-5 w-5 text-primary" />
        AI Coach
      </header>

      <ScrollArea className="flex-1 rounded-lg border p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Tell your coach what you want to work on today.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user" ? "flex justify-end" : "flex justify-start"
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
                    {message.parts
                      .map((part) => (part.type === "text" ? part.text : ""))
                      .join("")}
                  </CardContent>
                </Card>
              </div>
            ))
          )}
          {isStreaming && (
            <p className="text-sm text-muted-foreground">Coach is thinking…</p>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={isStreaming}
        />
        <Button type="submit" disabled={isStreaming || !input.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
