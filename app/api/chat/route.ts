import { streamText, convertToModelMessages, type UIMessage } from "ai";

// Allow streaming responses up to 30 seconds.
export const maxDuration = 30;

// System prompt that gives the assistant its coaching persona.
const SYSTEM_PROMPT = `You are AI Coach, a supportive and practical personal coach.
Help the user clarify goals, break them into actionable steps, and stay motivated.
Ask clarifying questions when the goal is vague, keep answers concise and encouraging,
and always end with a concrete next step the user can take today.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Passing a plain "provider/model" string routes the request through the
  // global provider, which defaults to the Vercel AI Gateway (configured via
  // AI_GATEWAY_API_KEY). Swap the string to try other models, e.g.
  // "openai/gpt-4o" or "google/gemini-2.5-pro".
  const result = streamText({
    model: "anthropic/claude-sonnet-4-6",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
