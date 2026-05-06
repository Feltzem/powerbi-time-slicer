# Time Slicer — Style Guide
**Version 1.0 | Flat Design System**

---

## 1. Design Philosophy

This visual lives inside Power BI dashboards — it must be **quiet enough to complement data** but **polished enough to look intentional**. The guiding principles are:

- **Flat first** — no box shadows, gradients, or bevels. Depth is created through spacing and colour contrast alone.
- **Purposeful colour** — one accent colour does all the work. Everything else is neutral.
- **Decisive typography** — one typeface, limited weights, consistent sizing scale.
- **Accessible by default** — contrast ratios meet WCAG AA at minimum.

---

## 2. Colour Palette

### Primary Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-accent` | `#0072BC` | Slider track fill, active button background, focus rings |
| `--color-accent-light` | `#D1E6F3` | Hover state on preset buttons, selected range indicator |
| `--color-accent-dark` | `#0362A2` | Pressed/active state for accent elements |

### Neutral Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#FFFFFF` | Visual background (transparent-compatible) |
| `--color-surface` | `#F8FAFC` | Preset button resting background |
| `--color-border` | `#E2E8F0` | Button borders, track background |
| `--color-track-bg` | `#E2E8F0` | Unfilled portion of slider track |
| `--color-text-primary` | `#0F172A` | Time labels, button text |
| `--color-text-secondary` | `#64748B` | "Selected" label, helper text |
| `--color-thumb` | `#FFFFFF` | Thumb handle fill |

### Semantic Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#10B981` | Play button (active/playing state) |
| `--color-reset` | `#F1F5F9` | Reset button resting background |
| `--color-reset-text` | `#475569` | Reset button label |

> **Dark mode note:** When Power BI is in dark mode, swap `--color-bg` → `#0F172A`, `--color-surface` → `#1E293B`, `--color-border` → `#334155`, and invert text tokens accordingly. The accent and semantic colours stay the same.

---

## 3. Typography

### Typeface
**DM Sans** (Google Fonts) — geometric sans-serif, highly legible at small sizes, neutral enough for data contexts.

```less
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
```

Fallback stack: `'DM Sans', 'Segoe UI', system-ui, sans-serif`

### Type Scale

| Role | Size | Weight | Letter-spacing | Element |
|---|---|---|---|---|
| Time label (start/end) | `13px` | 600 | `0.02em` | `.time-label` |
| Selected badge text | `12px` | 500 | `0` | `.selected-badge` |
| Preset button | `12px` | 500 | `0.01em` | `.preset-btn` |
| Header title | `11px` | 600 | `0.08em` (uppercase) | `.visual-title` |

> Never exceed 4 distinct text sizes in the visual at once.

---

## 4. Spacing & Layout

### Base Unit
`4px` — all spacing is a multiple of 4.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Icon padding, micro gaps |
| `--space-2` | `8px` | Inner button padding (vertical) |
| `--space-3` | `12px` | Inner button padding (horizontal) |
| `--space-4` | `16px` | Section gaps |
| `--space-5` | `20px` | Outer visual padding |
| `--space-6` | `24px` | Major section separation |

### Layout Rules
- Visual container: `padding: 16px 20px`
- Slider track: full-width minus `20px` each side
- Preset button row: `display: flex; flex-wrap: wrap; gap: 8px; justify-content: center`
- Controls row (play + reset): `display: flex; gap: 8px; justify-content: center`
- Minimum visual height: `140px`

---

## 5. Component Specifications

### 5.1 Slider Track

```
Height:       4px
Border-radius: 2px
Track (unfilled): var(--color-track-bg)
Track (filled):   var(--color-accent)
```

### 5.2 Thumb Handle

```
Width/Height:  16px × 16px
Border-radius: 50%
Background:    var(--color-thumb)
Border:        2px solid var(--color-accent)
Box-shadow:    none
Hover border:  2px solid var(--color-accent-dark)
Active scale:  transform: scale(1.15)  (transition: 100ms ease)
Focus ring:    outline: 2px solid var(--color-accent); outline-offset: 2px
```

### 5.3 Selected Range Badge

The centre badge showing "Xh Ym selected":
```
Background:    var(--color-accent-light)
Color:         var(--color-accent-dark)
Border-radius: 6px
Padding:       4px 10px
Font:          12px / 500
Border:        none
```

### 5.4 Preset Buttons (Morning, Inter-Peak, etc.)

```
Background (resting):  var(--color-surface)
Background (hover):    var(--color-accent-light)
Background (active):   var(--color-accent)
Color (resting):       var(--color-text-primary)
Color (active):        var(--color-accent)  [outlined style when active]
Border:                1.5px solid var(--color-border)
Border (active):       1.5px solid var(--color-accent)
Border-radius:         6px
Padding:               6px 12px
Font:                  12px / 500
Transition:            background 120ms ease, border-color 120ms ease
```

Active preset uses an **outlined style** — accent border + accent text on white background — rather than a filled button. This keeps the visual light.

### 5.5 Play Button

```
Width/Height:  36px × 36px
Border-radius: 50%
Background:    var(--color-accent)
Icon:          white ▶ (16px)
Hover:         background var(--color-accent-dark)
Playing state: background var(--color-success), icon ⏸
Transition:    background 150ms ease
```

### 5.6 Reset Button

```
Background:    var(--color-reset)
Color:         var(--color-reset-text)
Border:        none
Border-radius: 6px
Padding:       8px 16px
Font:          12px / 500
Hover:         background var(--color-border)
```

---

## 6. Motion & Transitions

Flat design uses **minimal, functional motion only**. No decorative animations.

| Interaction | Property | Duration | Easing |
|---|---|---|---|
| Button hover | `background-color` | `120ms` | `ease` |
| Thumb drag | `transform: scale()` | `100ms` | `ease` |
| Play→Pause icon swap | `opacity` | `150ms` | `ease` |
| Badge text update | `opacity` | `80ms` | `ease` |

> No bounce, spring, or elastic easing. No entrance/exit animations.

---

## 7. Iconography

Use **Phosphor Icons** (thin or regular weight) or inline SVGs only. No icon fonts.

| Element | Icon | Size |
|---|---|---|
| Play button | `play-fill` | 16px |
| Pause button | `pause-fill` | 16px |
| Reset button | Text label only — no icon | — |

---

## 8. What to Avoid

| ❌ Don't | ✓ Do instead |
|---|---|
| `box-shadow` on any element | Use `border` or `outline` for focus |
| Gradients on backgrounds or buttons | Flat single-colour fills |
| Border-radius > 8px (except circle) | Keep corners tight: 6px max |
| More than 2 accent hues at once | One accent colour with light tint |
| Bold orange "Reset" button | Quiet neutral reset |
| Mixed button shapes (pill + square) | Consistent 6px radius everywhere |
| Capitalised all-caps buttons | Sentence case only |
| Drop shadows on the slider thumb | Border + scale transform only |

---

## 9. Power BI Theming Integration

The visual should read its accent colour from the Power BI theme when available, falling back to `#0072BC`:

```typescript
const accentColor = this.settings.timeSlicer.accentColor || '#0072BC';
// Apply to slider fill, active buttons, badges
```

Expose these as formatting properties in `capabilities.json`:
- `accentColor` (colour picker, default `#0072BC`)
- `backgroundColor` (colour picker, default `#FFFFFF`)
- `textColor` (colour picker, default `#0F172A`)

---

*End of Style Guide*
