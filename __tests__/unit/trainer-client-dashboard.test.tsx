import { render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"
import {
  ClientDashboard,
  type ClientDashboardData,
  type PlanDetailWorkout,
  type PushStatus,
} from "@/app/[locale]/trainer/clients/[clientId]/client-dashboard"

/**
 * Behavior tests for the batch-24 additions to the trainer client dashboard:
 * full plan detail (every workout and exercise field), the gated PDF export
 * link, and the push-reminder status indicator. The dashboard is a client
 * component, so it renders inside a real next-intl provider against the shipped
 * catalogs - assertions run on the actual English and Hebrew copy.
 *
 * Its heavier children are out of scope here and mocked to keep the test focused
 * and free of jsdom-hostile deps: the charts (recharts), the regeneration
 * control (a server action + router), and the notes panel (its own batch-12
 * suite). The locale-aware `Link` becomes a plain anchor so the back link does
 * not require a router.
 */
vi.mock("@/app/[locale]/trainer/clients/[clientId]/progress-charts", () => ({
  ProgressCharts: () => null,
}))
vi.mock(
  "@/app/[locale]/trainer/clients/[clientId]/regenerate-client-plan",
  () => ({ RegenerateClientPlan: () => null })
)
vi.mock(
  "@/app/[locale]/trainer/clients/[clientId]/trainer-notes-panel",
  () => ({ TrainerNotesPanel: () => null })
)
vi.mock("@/app/[locale]/trainer/clients/[clientId]/plan-editor", () => ({
  PlanEditor: () => null,
}))
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const CLIENT_ID = "client-123"

/** A two-workout plan: one full session with a fully-populated exercise, one rest day. */
const planWorkouts: PlanDetailWorkout[] = [
  {
    id: "w1",
    dayLabel: "Monday",
    title: "Upper body",
    focus: "Push strength",
    notes: "Warm up before lifting.",
    isRestDay: false,
    exercises: [
      {
        id: "e1",
        name: "Bench press",
        sets: 4,
        reps: "8-10",
        duration: "20 min",
        rest: "90s",
        instructions: "Keep your back flat on the bench.",
        safetyNotes: "Use a spotter for heavy sets.",
      },
    ],
  },
  {
    id: "w2",
    dayLabel: "Sunday",
    title: "Recovery",
    focus: null,
    notes: null,
    isRestDay: true,
    exercises: [],
  },
]

/** Builds dashboard data with overridable plan/PDF/push fields for each case. */
function makeData(
  overrides: Partial<ClientDashboardData> = {}
): ClientDashboardData {
  return {
    clientId: CLIENT_ID,
    displayName: "Jane Athlete",
    profileFields: [],
    planTitle: "Strength block",
    completionPercent: 25,
    planWorkouts,
    pdfHref: `/api/pdf/workout-plan?clientId=${CLIENT_ID}&locale=en`,
    pushStatus: "enabled",
    weekly: [],
    monthly: [],
    logs: [],
    chat: [],
    whatsAppHref: null,
    notes: [],
    editor: null,
    ...overrides,
  }
}

/** Renders the dashboard inside a real next-intl provider for the given locale. */
function renderDashboard(
  locale: "en" | "he",
  overrides: Partial<ClientDashboardData> = {}
) {
  const messages = locale === "en" ? enMessages : heMessages
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ClientDashboard data={makeData(overrides)} />
    </NextIntlClientProvider>
  )
}

describe("ClientDashboard plan detail", () => {
  it("renders every workout and exercise field (en)", () => {
    renderDashboard("en")

    const pd = enMessages.TrainerDashboard.planDetail
    // Section header and the full-session workout.
    expect(
      screen.getByRole("heading", { level: 2, name: pd.title })
    ).toBeInTheDocument()
    expect(screen.getByText("Upper body")).toBeInTheDocument()
    expect(screen.getByText("Bench press")).toBeInTheDocument()

    // Every exercise field label + value is present.
    const exercise = screen
      .getByText("Bench press")
      .closest('[data-testid="plan-detail-exercise"]') as HTMLElement
    const exq = within(exercise)
    expect(exq.getByText(pd.sets)).toBeInTheDocument()
    expect(exq.getByText("4")).toBeInTheDocument()
    expect(exq.getByText(pd.reps)).toBeInTheDocument()
    expect(exq.getByText("8-10")).toBeInTheDocument()
    expect(exq.getByText(pd.duration)).toBeInTheDocument()
    expect(exq.getByText("20 min")).toBeInTheDocument()
    expect(exq.getByText(pd.rest)).toBeInTheDocument()
    expect(exq.getByText("90s")).toBeInTheDocument()
    expect(
      exq.getByText(/Keep your back flat on the bench\./)
    ).toBeInTheDocument()
    expect(exq.getByText(/Use a spotter for heavy sets\./)).toBeInTheDocument()

    // The rest day renders the localized rest indicator, no exercises.
    expect(screen.getByText(pd.restDay)).toBeInTheDocument()
  })

  it("renders the plan detail under /he (RTL catalog)", () => {
    renderDashboard("he")
    const pd = heMessages.TrainerDashboard.planDetail
    expect(
      screen.getByRole("heading", { level: 2, name: pd.title })
    ).toBeInTheDocument()
    expect(screen.getByText("Bench press")).toBeInTheDocument()
    expect(screen.getByText(pd.restDay)).toBeInTheDocument()
    // Hebrew field labels resolve from the catalog (e.g. sets = "סטים").
    expect(screen.getAllByText(pd.sets).length).toBeGreaterThan(0)
  })

  it("shows the empty state and hides the PDF button with no active plan", () => {
    renderDashboard("en", { planWorkouts: null, pdfHref: null })
    expect(
      screen.getByText(enMessages.TrainerDashboard.planDetail.empty)
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("trainer-export-plan-pdf")
    ).not.toBeInTheDocument()
  })
})

describe("ClientDashboard PDF export button", () => {
  it("links to the export route with the en locale", () => {
    renderDashboard("en")
    const link = screen.getByTestId("trainer-export-plan-pdf")
    expect(link).toHaveAttribute(
      "href",
      `/api/pdf/workout-plan?clientId=${CLIENT_ID}&locale=en`
    )
    expect(link).toHaveTextContent(enMessages.TrainerDashboard.plan.exportPdf)
  })

  it("links to the export route with the he locale", () => {
    renderDashboard("he", {
      pdfHref: `/api/pdf/workout-plan?clientId=${CLIENT_ID}&locale=he`,
    })
    const link = screen.getByTestId("trainer-export-plan-pdf")
    expect(link).toHaveAttribute(
      "href",
      `/api/pdf/workout-plan?clientId=${CLIENT_ID}&locale=he`
    )
    expect(link).toHaveTextContent(heMessages.TrainerDashboard.plan.exportPdf)
  })
})

describe("ClientDashboard push status", () => {
  const cases: PushStatus[] = ["enabled", "disabled", "unavailable"]
  for (const status of cases) {
    it(`shows the localized ${status} indicator`, () => {
      renderDashboard("en", { pushStatus: status })
      const indicator = screen.getByTestId("push-status")
      expect(indicator).toHaveAttribute("data-status", status)
      expect(indicator).toHaveTextContent(
        enMessages.TrainerDashboard.push[status]
      )
    })
  }

  it("shows the Hebrew enabled indicator under /he", () => {
    renderDashboard("he", { pushStatus: "enabled" })
    expect(screen.getByTestId("push-status")).toHaveTextContent(
      heMessages.TrainerDashboard.push.enabled
    )
  })
})
