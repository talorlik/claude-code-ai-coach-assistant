import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex max-w-2xl flex-col items-center gap-6">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Powered by Supabase
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your personal AI coaching companion
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            AI Coach Assistant helps you set goals, track progress, and get
            tailored guidance. Sign in to start a conversation with your coach.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Built with Next.js, Supabase, and shadcn/ui.
      </footer>
    </div>
  );
}
