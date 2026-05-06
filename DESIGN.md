# Time Slicer — Redesign Brief
**For AI agent implementation | Flat Design Refresh**

---

## Overview

This document is a complete implementation brief for redesigning the `powerbi-time-slicer` custom visual. The goal is to replace the current mixed-style UI (chunky orange buttons, blue slider, pill badges) with a cohesive, flat design that feels at home in professional Power BI dashboards.

**Repo:** https://github.com/Feltzem/powerbi-time-slicer  
**Files to modify:** `style/visual.less`, `src/visual.ts`  
**Style reference:** `STYLE_GUIDE.md` (in this repo root)

---

## Current State — What's Wrong

| Element | Current problem |
|---|---|
| Reset button | Filled orange — too visually heavy, clashes with blue |
| Preset buttons | Pill shape with blue border — inconsistent with flat guidelines |
| Selected badge | Blue filled — dominates the hierarchy |
| Slider thumb | Default browser rendering — varies across OS/browser |
| Title ("Time Range") | Serif-ish default font, no visual hierarchy |
| Overall spacing | Uneven — elements feel loosely arranged |
| Colour palette | Three competing accent colours (blue, orange, green) |

---

## Target State — What to Build

A single accent colour (`#0072BC`), neutral greys for secondary elements, DM Sans typeface, and a clean 4px spacing grid throughout. See `STYLE_GUIDE.md` for all exact values.

### Visual layout (top to bottom):

```
┌─────────────────────────────────────────────┐
│  TIME RANGE                         [label] │  ← 11px uppercase, --color-text-secondary
│                                             │
│  00:00    [ 6h 30m selected ]     24:00     │  ← time labels 13px/600, badge --accent-light
│                                             │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●   │  ← 4px track, 16px thumb with accent border
│                                             │
│        [▶]   [  Reset  ]                   │  ← 36px circle play, quiet reset btn
│                                             │
│  [Morning 7–9] [Inter-Peak 10–12] [PM 16–18] [Custom 09:00–17:00]  │
└─────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1 — `style/visual.less`

Replace the entire stylesheet with the following structure. Use CSS custom properties (variables) declared on `:root` so Power BI theming overrides can work.

#### Variables block
```less
:root {
  --color-accent:        #0072BC;
  --color-accent-light:  #D1E6F3;
  --color-accent-dark:   #0362A2;
  --color-bg:            #FFFFFF;
  --color-surface:       #F8FAFC;
  --color-border:        #E2E8F0;
  --color-track-bg:      #E2E8F0;
  --color-thumb:         #FFFFFF;
  --color-text-primary:  #0F172A;
  --color-text-secondary:#64748B;
  --color-success:       #10B981;
  --color-reset:         #F1F5F9;
  --color-reset-text:    #475569;
  --font-family:         'DM Sans', 'Segoe UI', system-ui, sans-serif;
}
```

#### Container
```less
.timeSlicerVisual {
  font-family: var(--font-family);
  background: var(--color-bg);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  min-height: 140px;
}
```

#### Title
```less
.visual-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  text-align: center;
}
```

#### Time labels row
```less
.time-labels-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.time-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  min-width: 40px;
}

.time-label--end {
  text-align: right;
}

.selected-badge {
  background: var(--color-accent-light);
  color: var(--color-accent-dark);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  transition: opacity 80ms ease;
}
```

#### Slider track + thumbs
```less
.slider-container {
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.slider-track-bg {
  position: absolute;
  left: 8px; right: 8px;
  height: 4px;
  background: var(--color-track-bg);
  border-radius: 2px;
}

.slider-track-fill {
  position: absolute;
  height: 4px;
  background: var(--color-accent);
  border-radius: 2px;
  /* left and width set dynamically via JS */
}

/* Override native range input */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  left: 0; right: 0;
  width: 100%;
  height: 4px;
  background: transparent;
  pointer-events: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-thumb);
    border: 2px solid var(--color-accent);
    cursor: pointer;
    pointer-events: all;
    transition: transform 100ms ease, border-color 100ms ease;

    &:hover {
      border-color: var(--color-accent-dark);
    }

    &:active {
      transform: scale(1.15);
    }
  }

  &:focus::-webkit-slider-thumb {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  /* Firefox */
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-thumb);
    border: 2px solid var(--color-accent);
    cursor: pointer;
    transition: transform 100ms ease;

    &:active { transform: scale(1.15); }
  }
}
```

#### Controls row (play + reset)
```less
.controls-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-play {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease;

  svg { fill: #FFFFFF; width: 16px; height: 16px; }

  &:hover { background: var(--color-accent-dark); }

  &.playing {
    background: var(--color-success);
  }
}

.btn-reset {
  background: var(--color-reset);
  color: var(--color-reset-text);
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-family);
  cursor: pointer;
  transition: background 120ms ease;

  &:hover { background: var(--color-border); }
}
```

#### Preset buttons
```less
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.preset-btn {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-family);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  white-space: nowrap;

  &:hover {
    background: var(--color-accent-light);
    border-color: var(--color-accent);
  }

  &.active {
    background: var(--color-bg);
    color: var(--color-accent);
    border-color: var(--color-accent);
    font-weight: 600;
  }
}
```

---

### Task 2 — `src/visual.ts`

#### 2a. Remove orange Reset button styling
Find any hardcoded colour values applied to the reset button element and remove them. The button's appearance is now fully controlled by `--color-reset` and `--color-reset-text` in the stylesheet.

#### 2b. Apply DM Sans font
Add this `<link>` injection into the visual's DOM initialisation (inside `constructor` or `init`):

```typescript
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap';
document.head.appendChild(fontLink);
```

> If the visual runs in an offline/air-gapped environment, bundle DM Sans via `npm install @fontsource/dm-sans` and import it instead.

#### 2c. Dynamic slider track fill
The filled portion of the slider track must be computed and applied in JS (since CSS `appearance: none` removes the native fill). Add or update a method:

```typescript
private updateTrackFill(): void {
  const min = this.sliderMin;  // your existing min value
  const max = this.sliderMax;  // your existing max value
  const start = this.currentStart;
  const end = this.currentEnd;

  const leftPct  = ((start - min) / (max - min)) * 100;
  const widthPct = ((end - start)  / (max - min)) * 100;

  this.trackFillEl.style.left  = `${leftPct}%`;
  this.trackFillEl.style.width = `${widthPct}%`;
}
```

Call `updateTrackFill()` on every slider `input` event.

#### 2d. Play button icon swap
Use inline SVG rather than emoji/text characters for the play and pause icons so they scale cleanly:

```typescript
const ICON_PLAY  = `<svg viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14" fill="white"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 16 16"><rect x="3" y="2" width="4" height="12" fill="white"/><rect x="9" y="2" width="4" height="12" fill="white"/></svg>`;

// Toggle in the play button click handler:
this.playBtn.innerHTML = this.isPlaying ? ICON_PAUSE : ICON_PLAY;
this.playBtn.classList.toggle('playing', this.isPlaying);
```

#### 2e. Remove hardcoded colour overrides
Audit `visual.ts` for any `element.style.backgroundColor`, `element.style.color`, or similar inline style assignments that were previously needed to apply the orange/blue styling. Remove them — all colour is now handled through CSS variables and class toggles (`.active`, `.playing`).

#### 2f. CSS variable theming from Power BI settings
When the user changes `accentColor` in the formatting pane, update the CSS variable on the container rather than applying styles per-element:

```typescript
private applyTheme(): void {
  const accent = this.settings.timeSlicer.accentColor || '#0072BC';
  this.container.style.setProperty('--color-accent', accent);
  // Derive light/dark from accent if needed, or just update those too:
  this.container.style.setProperty('--color-accent-dark', this.darken(accent, 10));
}
```

---

## Acceptance Criteria

When the redesign is complete, the visual should satisfy all of the following:

- [ ] **No orange** anywhere in the default theme
- [ ] Reset button is quiet — neutral grey, no border
- [ ] Slider thumb is a clean white circle with accent border (no browser default styling)
- [ ] Track fill is accent blue between the two thumbs only
- [ ] All buttons share the same 6px border-radius
- [ ] Preset buttons use outlined-active style (accent border + text, not filled) when selected
- [ ] DM Sans font is applied throughout
- [ ] Play button is a circular accent-blue button that turns green when playing
- [ ] Spacing is consistent (4px grid)
- [ ] No `box-shadow` on any element
- [ ] No gradients
- [ ] Selected badge is light blue pill (not bold filled blue)
- [ ] All interactive elements have a visible focus state for keyboard accessibility
- [ ] CSS variables are used for all colours (no hardcoded hex values in `.less` rules outside the `:root` block)
- [ ] Visual renders correctly at minimum 200px width

---

## Out of Scope

The following are **not** part of this redesign task:

- Changing any Power BI data binding or filter logic
- Adding new preset buttons or changing their time ranges
- Modifying `capabilities.json` beyond what's noted in Task 2f
- Dark mode implementation (document as a future task)
- Animation of the slider playback

---

## File Change Summary

| File | Type of change |
|---|---|
| `style/visual.less` | Full rewrite — see Task 1 |
| `src/visual.ts` | Targeted edits — see Task 2a–2f |
| `STYLE_GUIDE.md` | New file — design system reference (do not modify) |
| All other files | No changes |

---

*End of Redesign Brief*
