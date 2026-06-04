"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Copy, Pencil, Plus, UserPlus } from "lucide-react"

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  createTemplateAction,
  updateTemplateAction,
  duplicateTemplateAction,
  assignTemplateAction,
} from "@/lib/trainer/template-actions"
import { TEMPLATE_LOCALES } from "@/lib/trainer/template-validation"
import type { Locale } from "@/i18n/routing"

/**
 * A plain, serializable plan template for the manager. The page maps the stored
 * row into this shape, stringifying the structured payload so the form edits it
 * as text.
 */
export interface TemplateItem {
  /** The template's id. */
  id: string
  /** Template title. */
  title: string
  /** Optional description. */
  description: string | null
  /** Optional locale tag the content is authored in. */
  locale: string | null
  /** The structured payload, pretty-printed as JSON for the editor. */
  payloadJson: string
}

/** A client the trainer can assign a template to. */
export interface ClientOption {
  /** The client's auth user id. */
  userId: string
  /** Display label (full name, or a localized fallback). */
  label: string
}

/** Validator field-error codes the template form knows how to localize. */
const FIELD_ERROR_KEYS = ["required", "tooLong", "invalid"] as const
type FieldErrorKey = (typeof FIELD_ERROR_KEYS)[number]

/** Narrows an arbitrary field-error code to a known, localizable error. */
function isFieldErrorKey(code: string | undefined): code is FieldErrorKey {
  return code != null && (FIELD_ERROR_KEYS as readonly string[]).includes(code)
}

/** Editable form fields for creating or editing a template. */
interface TemplateForm {
  title: string
  description: string
  locale: string
  payloadJson: string
}

/** An empty starter payload that satisfies the plan schema's required shape. */
const STARTER_PAYLOAD = JSON.stringify(
  {
    title: "",
    summary: "",
    safety_notes:
      "Not medical advice. Stop and consult a professional if you feel pain.",
    workouts: [
      {
        day_of_week: "monday",
        title: "",
        focus: null,
        notes: null,
        exercises: [
          {
            name: "",
            sets: 3,
            reps: "8-12",
            duration: null,
            rest: "60-90s",
            instructions: "",
            safety_notes: null,
          },
        ],
      },
    ],
  },
  null,
  2
)

/**
 * Interactive trainer plan-template manager. Renders the template library as a
 * responsive card grid and drives create, edit, duplicate, and assign actions
 * through the trainer template server actions. The in-memory list is updated
 * from each action's returned row so the UI stays responsive without a full
 * reload (the actions also revalidate the page on the server). Only the trainer
 * admin reaches this surface; the actions independently re-check that, and RLS
 * is the database backstop.
 *
 * The structured plan payload is edited as JSON text; it is parsed client-side
 * for fast feedback, but the server action re-validates it authoritatively
 * against the shared plan schema, so an invalid body is never saved.
 *
 * All copy comes from the `TrainerPlans` namespace; validator error codes are
 * mapped to localized messages so failures read naturally in both locales.
 *
 * @param locale - The active URL locale prefix (drives the default form locale).
 * @param initialTemplates - Server-rendered templates seeding the list.
 * @param clients - Clients available in the assign picker.
 */
export function PlansManager({
  locale,
  initialTemplates,
  clients,
}: {
  locale: Locale
  initialTemplates: TemplateItem[]
  clients: ClientOption[]
}) {
  const t = useTranslations("TrainerPlans")

  const [templates, setTemplates] =
    React.useState<TemplateItem[]>(initialTemplates)
  const [pending, setPending] = React.useState(false)
  const [editor, setEditor] = React.useState<{
    mode: "create" | "edit"
    id: string | null
    form: TemplateForm
  } | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [assignFor, setAssignFor] = React.useState<TemplateItem | null>(null)
  const [assignClientId, setAssignClientId] = React.useState<string>("")
  const [feedback, setFeedback] = React.useState<string | null>(null)

  const defaultLocaleTag = locale === "he" ? "he-IL" : "en-US"

  /** Translates a server failure (field code or generic) to display copy. */
  function messageFor(result: {
    error: string
    fieldErrors?: Record<string, string>
  }): string {
    const fields = result.fieldErrors ?? {}
    for (const field of ["title", "description", "locale", "payload"] as const) {
      const code = fields[field]
      if (isFieldErrorKey(code)) return t(`errors.${field}.${code}`)
    }
    return result.error || t("errors.generic")
  }

  /** Opens the create dialog with a starter payload. */
  function openCreate() {
    setFormError(null)
    setEditor({
      mode: "create",
      id: null,
      form: {
        title: "",
        description: "",
        locale: defaultLocaleTag,
        payloadJson: STARTER_PAYLOAD,
      },
    })
  }

  /** Opens the edit dialog seeded from an existing template. */
  function openEdit(template: TemplateItem) {
    setFormError(null)
    setEditor({
      mode: "edit",
      id: template.id,
      form: {
        title: template.title,
        description: template.description ?? "",
        locale: template.locale ?? defaultLocaleTag,
        payloadJson: template.payloadJson,
      },
    })
  }

  /** Parses the JSON payload, surfacing a localized error on malformed input. */
  function parsePayload(json: string): { ok: true; value: unknown } | null {
    try {
      return { ok: true, value: JSON.parse(json) }
    } catch {
      setFormError(t("errors.payload.invalid"))
      return null
    }
  }

  /** Submits the create/edit form. */
  async function onSubmit() {
    if (!editor) return
    setFormError(null)

    const parsed = parsePayload(editor.form.payloadJson)
    if (!parsed) return

    const input = {
      title: editor.form.title,
      description: editor.form.description,
      locale: editor.form.locale,
      payload: parsed.value,
    }

    setPending(true)
    try {
      const result =
        editor.mode === "create"
          ? await createTemplateAction(input)
          : await updateTemplateAction(editor.id!, input)

      if (!result.ok) {
        setFormError(messageFor(result))
        return
      }

      const item: TemplateItem = {
        id: result.data.id,
        title: result.data.title,
        description: result.data.description,
        locale: result.data.locale,
        payloadJson: JSON.stringify(result.data.payload, null, 2),
      }
      setTemplates((prev) =>
        editor.mode === "create"
          ? [item, ...prev]
          : prev.map((x) => (x.id === item.id ? item : x))
      )
      setEditor(null)
    } finally {
      setPending(false)
    }
  }

  /** Duplicates a template and prepends the copy to the list. */
  async function onDuplicate(template: TemplateItem) {
    setFeedback(null)
    setPending(true)
    try {
      const result = await duplicateTemplateAction(template.id)
      if (!result.ok) {
        setFeedback(messageFor(result))
        return
      }
      const copy: TemplateItem = {
        id: result.data.id,
        title: result.data.title,
        description: result.data.description,
        locale: result.data.locale,
        payloadJson: JSON.stringify(result.data.payload, null, 2),
      }
      setTemplates((prev) => [copy, ...prev])
    } finally {
      setPending(false)
    }
  }

  /** Assigns the selected template to the chosen client. */
  async function onAssign() {
    if (!assignFor || assignClientId === "") return
    setFeedback(null)
    setPending(true)
    try {
      const result = await assignTemplateAction(assignFor.id, assignClientId)
      if (!result.ok) {
        setFeedback(messageFor(result))
        return
      }
      setFeedback(t("assign.success"))
      setAssignFor(null)
      setAssignClientId("")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("library.title")}</h2>
        <Button onClick={openCreate} disabled={pending}>
          <Plus className="size-4" />
          {t("actions.create")}
        </Button>
      </div>

      {feedback ? (
        <p role="status" className="text-sm text-muted-foreground">
          {feedback}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <li key={template.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="break-words">{template.title}</CardTitle>
                  {template.description ? (
                    <CardDescription className="break-words">
                      {template.description}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {template.locale
                    ? t("library.localeLabel", { locale: template.locale })
                    : t("library.localeUnset")}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(template)}
                    disabled={pending}
                  >
                    <Pencil className="size-4" />
                    {t("actions.edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onDuplicate(template)}
                    disabled={pending}
                  >
                    <Copy className="size-4" />
                    {t("actions.duplicate")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setFeedback(null)
                      setAssignClientId("")
                      setAssignFor(template)
                    }}
                    disabled={pending || clients.length === 0}
                  >
                    <UserPlus className="size-4" />
                    {t("actions.assign")}
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "edit"
                ? t("form.editTitle")
                : t("form.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>

          {editor ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-title">{t("form.fields.title")}</Label>
                <Input
                  id="template-title"
                  value={editor.form.title}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      form: { ...editor.form, title: e.target.value },
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-description">
                  {t("form.fields.description")}
                </Label>
                <Textarea
                  id="template-description"
                  rows={2}
                  value={editor.form.description}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      form: { ...editor.form, description: e.target.value },
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-locale">
                  {t("form.fields.locale")}
                </Label>
                <NativeSelect
                  id="template-locale"
                  value={editor.form.locale}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      form: { ...editor.form, locale: e.target.value },
                    })
                  }
                >
                  {TEMPLATE_LOCALES.map((tag) => (
                    <NativeSelectOption key={tag} value={tag}>
                      {tag}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-payload">
                  {t("form.fields.payload")}
                </Label>
                <Textarea
                  id="template-payload"
                  className="font-mono text-xs"
                  rows={10}
                  value={editor.form.payloadJson}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      form: { ...editor.form, payloadJson: e.target.value },
                    })
                  }
                />
              </div>

              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor(null)}
              disabled={pending}
            >
              {t("form.cancel")}
            </Button>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? t("form.saving") : t("form.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog
        open={assignFor !== null}
        onOpenChange={(open) => {
          if (!open) setAssignFor(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assign.title")}</DialogTitle>
            <DialogDescription>
              {t("assign.description", { title: assignFor?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-client">{t("assign.client")}</Label>
            <NativeSelect
              id="assign-client"
              value={assignClientId}
              onChange={(e) => setAssignClientId(e.target.value)}
            >
              <NativeSelectOption value="">
                {t("assign.choose")}
              </NativeSelectOption>
              {clients.map((c) => (
                <NativeSelectOption key={c.userId} value={c.userId}>
                  {c.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignFor(null)}
              disabled={pending}
            >
              {t("form.cancel")}
            </Button>
            <Button
              type="button"
              onClick={onAssign}
              disabled={pending || assignClientId === ""}
            >
              {pending ? t("assign.assigning") : t("assign.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
