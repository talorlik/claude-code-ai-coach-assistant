# Website Design System

This is the canonical styling guide for the website. It keeps the original
sports-broadside attitude from the first design reference, but changes the
intent from dark-first to fully theme-aware. The visual system must work in both
dark and light themes without separate component implementations.

The hierarchy is:

1. `:root` defines common tokens shared by every theme.
1. `.dark` defines the dark palette from `COLOR_PALETTE_DARK.md`.
1. `.light` defines the light palette from `COLOR_PALETTE_LIGHT.md`.

The website should use semantic tokens in application code. Components come
primarily from [tweakcn][tweakcn] and shadcn/ui conventions. Sport photography
should come from the [Unsplash sport search][unsplash-sport] unless a more
specific approved source is introduced.

## Table Of Contents

- [Design Intent](#design-intent)
- [Common](#common)
- [Dark](#dark)
- [Light](#light)
- [Token Reference](#token-reference)
- [Components](#components)
- [Imagery](#imagery)
- [Do](#do)
- [Don't](#dont)
- [Implementation Notes](#implementation-notes)

## Design Intent

The website should feel like a modern fitness club poster translated into a
product interface: direct, athletic, editorial, and highly typographic. Display
headlines should carry the brand energy. Components should stay calm and
structured so the site remains usable for onboarding, plan review, chat, profile
management, and trainer workflows.

The dark theme keeps the original red, amber, and warm-stone atmosphere. The
light theme should not feel like a washed-out copy of dark mode. It uses a
cleaner stone-gray canvas, an orange primary action, and a blue editorial accent
while preserving the same typography, layout, radius, and component behavior.

## Common

Common tokens describe the shared design language. Do not place theme-specific
colors in `:root`. Theme classes own all palette values.

### Visual Principles

- Use oversized condensed display typography for hero and section moments.
- Use quiet body typography for forms, navigation, cards, and labels.
- Keep components semantic: `bg-background`, `text-foreground`,
  `bg-card`, `text-muted-foreground`, `border-border`, and `bg-primary`.
- Use tweakcn/shadcn components as the base, then theme them through tokens.
- Use `className` for layout and spacing, not one-off color overrides.
- Avoid manual `dark:` Tailwind color overrides. Theme classes should switch
  semantic tokens globally.
- Keep imagery athletic and natural. Favor real training, movement, coaching,
  sport courts, gyms, outdoor sessions, and close-cropped details.

### Typography

Display type is the primary brand voice. If the paid fonts are unavailable, use
the listed fallbacks while preserving the same role and proportions.

#### Druk Condensed Super Desktop

- **Substitute:** Oswald 700, Bebas Neue, or Anton.
- **Weights:** 400, 500, 700.
- **Role:** Hero headlines, large section titles, poster labels, and compact
  stat callouts.
- **Behavior:** Tight, condensed, edge-to-edge, and mostly uppercase.

#### Neue Montreal

- **Substitute:** Poppins, Inter, Manrope, or DM Sans.
- **Weights:** 400, 500, 600.
- **Role:** Body copy, forms, navigation, buttons, tables, captions, and app
  chrome.
- **Behavior:** Compact, readable, and subordinate to the display type.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
| ---- | ---- | ----------- | -------------- | ----- |
| Caption | 12px | 1.43 | -0.22px | `--text-caption` |
| Body Small | 14px | 1.43 | -0.22px | `--text-body-sm` |
| Body | 16px | 1.4 | -0.22px | `--text-body` |
| Subheading | 24px | 1 | 0.05px | `--text-subheading` |
| Heading Small | 32px | 0.9 | 0.05px | `--text-heading-sm` |
| Heading | 58px | 1.1 | -0.22px | `--text-heading` |
| Display | 187px | 0.85 | 0.05px | `--text-display` |
| Display XL | 317px | 0.78 | 0.05px | `--text-display-xl` |

### Spacing And Shape

| Token | Value | Purpose |
| ----- | ----- | ------- |
| `--spacing-unit` | 8px | Base rhythm |
| `--spacing-8` | 8px | Inline gaps and dense controls |
| `--spacing-16` | 16px | Form and card internal rhythm |
| `--spacing-32` | 32px | Component grouping |
| `--spacing-40` | 40px | Page blocks |
| `--spacing-48` | 48px | Section padding |
| `--spacing-160` | 160px | Large hero spacing |
| `--spacing-192` | 192px | Full editorial spacing |

| Element | Value |
| ------- | ----- |
| Tags | 6px |
| Cards | 14px |
| Pills | 9999px |
| Buttons | 9999px |
| Special panels | 24px |

### Layout

- **Page max-width:** 1200px.
- **Section gap:** 64px.
- **Card padding:** 20px.
- **Element gap:** 8px.
- **Density:** Comfortable for marketing pages, compact for dashboards.
- **Alignment:** Left-align display headlines. Center alignment is reserved for
  focused empty states and compact confirmation screens.

### Component Source

Use tweakcn/shadcn components as the implementation foundation. Prefer existing
components and variants before writing custom markup:

- Actions: `Button`.
- Layout and content: `Card`, `Separator`, `Accordion`, `Tabs`.
- Forms: `FieldGroup`, `Field`, `Input`, `Select`, `Textarea`, `Switch`.
- Feedback: `Alert`, `Progress`, `Skeleton`, Sonner toast.
- Data display: `Table`, `Badge`, `Avatar`, charts built around Recharts.
- Navigation: `NavigationMenu`, `Sidebar`, `Breadcrumb`, `Tabs`.
- Overlays: `Dialog`, `Sheet`, `Drawer`, `AlertDialog`.

All component styling should flow through semantic tokens and component variants.
Do not hardcode palette values inside components unless documenting a token.

## Dark

The dark theme is a midnight sports broadside: warm stone canvas, deep red
primary action, amber heat accents, and cream text. It should feel focused,
physical, and premium without becoming neon or sci-fi.

### Dark Palette Intent

- Use `--background` as the dominant page canvas.
- Use `--card`, `--muted`, and `--popover` for lifted surfaces.
- Use `--primary` for primary actions, active states, logo marks, and key
  display emphasis.
- Use `--accent` and `--secondary` as punctuation, not dominant surfaces.
- Use `--foreground` and `--muted-foreground` for readable hierarchy.

## Light

The light theme is an editorial training notebook: airy, clear, and structured,
with orange action and blue supporting accents. It should preserve the same
athletic typographic confidence while feeling open and approachable.

### Light Palette Intent

- Use `--background` as the main stone-gray canvas.
- Use `--card` and `--popover` for clean content surfaces.
- Use `--primary` for primary actions and critical conversion moments.
- Use `--accent` for supportive blue panels, filters, and secondary emphasis.
- Use `--foreground` and `--muted-foreground` to keep long-form content
  readable.

## Token Reference

This block folds the palettes into the design document in the required order:
common `:root`, then `.dark`, then `.light`.

```css
:root {
  color-scheme: light dark;

  /* Font Families */
  --font-family-display:
    "Druk Condensed Super Desktop", "Oswald", "Bebas Neue", "Anton",
    ui-sans-serif, system-ui, sans-serif;
  --font-family-sans:
    "Neue Montreal", "Poppins", "Inter", "Manrope", ui-sans-serif,
    system-ui, sans-serif;
  --font-family-serif: "Libre Baskerville", "Source Serif 4", ui-serif, serif;
  --font-family-mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace,
    monospace;

  /* Typography */
  --text-caption: 12px;
  --leading-caption: 1.43;
  --tracking-caption: -0.22px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --tracking-body-sm: -0.22px;
  --text-body: 16px;
  --leading-body: 1.4;
  --tracking-body: -0.22px;
  --text-subheading: 24px;
  --leading-subheading: 1;
  --tracking-subheading: 0.05px;
  --text-heading-sm: 32px;
  --leading-heading-sm: 0.9;
  --tracking-heading-sm: 0.05px;
  --text-heading: 58px;
  --leading-heading: 1.1;
  --tracking-heading: -0.22px;
  --text-display: 187px;
  --leading-display: 0.85;
  --tracking-display: 0.05px;
  --text-display-xl: 317px;
  --leading-display-xl: 0.78;
  --tracking-display-xl: 0.05px;

  /* Font Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-160: 160px;
  --spacing-192: 192px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 64px;
  --card-padding: 20px;
  --element-gap: 8px;

  /* Radius */
  --radius: 0.75rem;
  --radius-md: 6px;
  --radius-xl: 14px;
  --radius-3xl: 24px;
  --radius-tags: 6px;
  --radius-cards: 14px;
  --radius-pills: 9999px;
  --radius-buttons: 9999px;
  --radius-special: 24px;

  /* Shadows */
  --shadow-offset-x: 0px;
  --shadow-offset-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
}

.dark {
  color-scheme: dark;

  --card: #292524;
  --ring: #b91c1c;
  --input: #44403c;
  --muted: #292524;
  --accent: #b45309;
  --border: #44403c;
  --chart-1: #f87171;
  --chart-2: #ef4444;
  --chart-3: #dc2626;
  --chart-4: #fbbf24;
  --chart-5: #f59e0b;
  --popover: #292524;
  --primary: #b91c1c;
  --sidebar: #1c1917;
  --secondary: #92400e;
  --background: #1c1917;
  --foreground: #f5f5f4;
  --destructive: #ef4444;
  --shadow-color: hsl(0 63% 18%);
  --sidebar-ring: #b91c1c;
  --shadow-blur: 16px;
  --shadow-spread: -2px;
  --shadow-opacity: 0.12;
  --shadow-offset-x: 1px;
  --shadow-offset-y: 1px;
  --sidebar-accent: #b45309;
  --sidebar-border: #44403c;
  --card-foreground: #f5f5f4;
  --sidebar-primary: #b91c1c;
  --muted-foreground: #d6d3d1;
  --accent-foreground: #fef3c7;
  --popover-foreground: #f5f5f4;
  --primary-foreground: #faf7f5;
  --sidebar-foreground: #f5f5f4;
  --secondary-foreground: #fef3c7;
  --destructive-foreground: #ffffff;
  --sidebar-accent-foreground: #fef3c7;
  --sidebar-primary-foreground: #faf7f5;
}

.light {
  color-scheme: light;

  --card: #ffffff;
  --ring: #e05d38;
  --input: #f4f5f7;
  --muted: #f9fafb;
  --accent: #d6e4f0;
  --border: #dcdfe2;
  --chart-1: #86a7c8;
  --chart-2: #eea591;
  --chart-3: #5a7ca6;
  --chart-4: #466494;
  --chart-5: #334c82;
  --popover: #ffffff;
  --primary: #e05d38;
  --sidebar: #dddfe2;
  --secondary: #f3f4f6;
  --background: #e8ebed;
  --foreground: #333333;
  --destructive: #ef4444;
  --shadow-color: hsl(0 0% 0%);
  --sidebar-ring: #e05d38;
  --sidebar-accent: #d6e4f0;
  --sidebar-border: #e5e7eb;
  --card-foreground: #333333;
  --sidebar-primary: #e05d38;
  --muted-foreground: #6b7280;
  --accent-foreground: #1e3a8a;
  --popover-foreground: #333333;
  --primary-foreground: #ffffff;
  --sidebar-foreground: #333333;
  --secondary-foreground: #4b5563;
  --destructive-foreground: #ffffff;
  --sidebar-accent-foreground: #1e3a8a;
  --sidebar-primary-foreground: #ffffff;
}

@theme inline {
  --color-card: var(--card);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-border: var(--border);
  --color-radius: var(--radius);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-popover: var(--popover);
  --color-primary: var(--primary);
  --color-sidebar: var(--sidebar);
  --color-secondary: var(--secondary);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-destructive: var(--destructive);
  --color-shadow-blur: var(--shadow-blur);
  --color-shadow-color: var(--shadow-color);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-shadow-spread: var(--shadow-spread);
  --color-shadow-opacity: var(--shadow-opacity);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-border: var(--sidebar-border);
  --color-card-foreground: var(--card-foreground);
  --color-shadow-offset-x: var(--shadow-offset-x);
  --color-shadow-offset-y: var(--shadow-offset-y);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent-foreground: var(--accent-foreground);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary-foreground: var(--primary-foreground);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);

  --font-display: var(--font-family-display);
  --font-sans: var(--font-family-sans);
  --font-serif: var(--font-family-serif);
  --font-mono: var(--font-family-mono);
}
```

## Components

### Hero Display

Hero sections should use a large condensed word stack, a short supporting line,
and one clear action. In dark mode, let red display type dominate the warm dark
canvas. In light mode, use the orange primary more selectively and lean on
foreground text for readability.

### Navigation

Navigation should be sparse and stable: logo left, links center or collapsed,
and primary action right. Use transparent or lightly surfaced navigation on
marketing pages. Use `Sidebar` or `Tabs` for authenticated app workflows.

### Buttons

Primary buttons use `--primary` with `--primary-foreground`. Secondary and
outline buttons should use component variants rather than custom colors. Buttons
remain pill-shaped through `--radius-buttons`.

### Cards

Cards use `--card`, `--card-foreground`, and `--border`. Avoid heavy elevation.
Use border, surface contrast, and spacing to separate dashboard content.

### Forms

Forms should feel practical and confident. Use `FieldGroup`, `Field`, semantic
validation states, and compact helper text. Do not create custom form wrappers
when a tweakcn/shadcn component already exists.

### Badges And Tags

Use `Badge` for status, plan metadata, workout labels, trainer notes, and role
markers. Keep tags compact. Dark mode can use red, amber, and umber accents.
Light mode can use orange and blue accents.

### Charts And Progress

Use chart tokens for progress and dashboard visuals. Keep charts restrained:
one primary series, one comparison series, and muted grid lines. Fitness data
should read quickly before it feels decorative.

## Imagery

Photography should support the coaching story rather than replace the
typographic identity. Use Unsplash sport imagery with these rules:

- Prefer real movement, coaching moments, courts, weights, mobility work, and
  close-cropped athletic details.
- Favor warm, high-contrast images in dark mode.
- Favor cleaner daylight or neutral training images in light mode.
- Avoid generic stock smiles, staged laptop scenes, or images where the sport is
  unclear.
- Crop images aggressively. The site should feel editorial, not like a stock
  gallery.
- Overlay text only when contrast is guaranteed in both themes.

## Do

- Use semantic tokens for all theme-aware styling.
- Keep the same layout, typography, spacing, and radius across dark and light.
- Use tweakcn/shadcn components before custom markup.
- Let large display type create the brand moment.
- Use sport imagery as supporting atmosphere, not as the whole design.
- Keep dark mode warm and intense.
- Keep light mode open, structured, and readable.

## Don't

- Don't make dark and light themes separate websites.
- Don't put dark-only or light-only color decisions in component classes.
- Don't use raw hex values in implementation code except inside token files.
- Don't add neon colors or unrelated gradients.
- Don't use heavy shadows as the main depth mechanism.
- Don't center every headline. The poster style is strongest when left-aligned.
- Don't mix unrelated component systems when tweakcn/shadcn has the component.

## Implementation Notes

- The theme switcher should apply `.dark` or `.light` at the app root.
- If no explicit theme is chosen, the app may default to `.light` while still
  respecting persisted user preference.
- Tailwind classes should consume tokens through `@theme inline`.
- Component examples should document token usage, not raw color values.
- Keep `COLOR_PALETTE_DARK.md` and `COLOR_PALETTE_LIGHT.md` as source palette
  references, but treat this document as the website's de facto styling guide.

[tweakcn]: https://tweakcn.com/
[unsplash-sport]: https://unsplash.com/s/photos/sport
