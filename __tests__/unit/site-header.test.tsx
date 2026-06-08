import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"

/**
 * Behavior test for the SiteHeader nav (batch 21). The header is an async server
 * component; its auth seam (`createClient.getUser`), role lookup (`isAdmin`),
 * and `getTranslations` are stubbed, and the client-only affordances are
 * replaced with inert stubs so the test asserts only the nav-link logic:
 *
 * - a signed-in non-admin sees the My Plan link;
 * - a signed-out visitor does not;
 * - an admin sees the trainer/admin links but not My Plan.
 */

let currentUser: { id: string } | null = null
let adminFlag = false

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}))
vi.mock("@/lib/auth/roles", () => ({
  isAdmin: async () => adminFlag,
}))
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const messages = enMessages as unknown as Record<
      string,
      Record<string, string>
    >
    return (key: string) => messages[namespace][key]
  },
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
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock("@/components/mode-toggle", () => ({ ModeToggle: () => null }))
vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => null,
}))
vi.mock("@/components/install-prompt", () => ({ InstallPrompt: () => null }))

import { SiteHeader } from "@/components/site-header"

/** Awaits the async server component and mounts its produced markup. */
async function renderHeader() {
  const ui = await SiteHeader()
  return render(ui)
}

const myPlanLabel = enMessages.Nav.myPlan

beforeEach(() => {
  currentUser = null
  adminFlag = false
})

const adminLabel = enMessages.Nav.admin
const clientsLabel = enMessages.Nav.clients
const aboutLabel = enMessages.Nav.about
const contactLabel = enMessages.Nav.contact

describe("SiteHeader public links", () => {
  it("shows About and Contact to a signed-out visitor", async () => {
    currentUser = null
    await renderHeader()
    expect(
      screen.getByRole("link", { name: aboutLabel })
    ).toHaveAttribute("href", "/en/about")
    expect(
      screen.getByRole("link", { name: contactLabel })
    ).toHaveAttribute("href", "/en/contact")
  })

  it("shows About and Contact to a signed-in non-admin", async () => {
    currentUser = { id: "user-1" }
    adminFlag = false
    await renderHeader()
    expect(
      screen.getByRole("link", { name: aboutLabel })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: contactLabel })
    ).toBeInTheDocument()
  })

  it("shows About and Contact to a signed-in admin", async () => {
    currentUser = { id: "admin-1" }
    adminFlag = true
    await renderHeader()
    expect(
      screen.getByRole("link", { name: aboutLabel })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: contactLabel })
    ).toBeInTheDocument()
  })
})

describe("SiteHeader My Plan link", () => {
  it("shows the My Plan link to a signed-in non-admin", async () => {
    currentUser = { id: "user-1" }
    await renderHeader()
    const link = screen.getByRole("link", { name: myPlanLabel })
    expect(link).toHaveAttribute("href", "/en/my-plan")
  })

  it("does not show the My Plan link to a signed-out visitor", async () => {
    currentUser = null
    await renderHeader()
    expect(
      screen.queryByRole("link", { name: myPlanLabel })
    ).not.toBeInTheDocument()
  })

  it("does not show the My Plan link to an admin", async () => {
    currentUser = { id: "admin-1" }
    adminFlag = true
    await renderHeader()
    expect(
      screen.queryByRole("link", { name: myPlanLabel })
    ).not.toBeInTheDocument()
  })
})

describe("SiteHeader admin navigation", () => {
  it("shows an admin both the Admin (/admin) and Clients (/trainer) links", async () => {
    currentUser = { id: "admin-1" }
    adminFlag = true
    await renderHeader()
    expect(
      screen.getByRole("link", { name: adminLabel })
    ).toHaveAttribute("href", "/en/admin")
    expect(
      screen.getByRole("link", { name: clientsLabel })
    ).toHaveAttribute("href", "/en/trainer")
  })

  it("hides both the Admin and Clients links from a signed-in non-admin", async () => {
    currentUser = { id: "user-1" }
    adminFlag = false
    await renderHeader()
    expect(
      screen.queryByRole("link", { name: adminLabel })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: clientsLabel })
    ).not.toBeInTheDocument()
  })

  it("hides both the Admin and Clients links from a signed-out visitor", async () => {
    currentUser = null
    await renderHeader()
    expect(
      screen.queryByRole("link", { name: adminLabel })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: clientsLabel })
    ).not.toBeInTheDocument()
  })
})
