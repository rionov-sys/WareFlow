---
name: Hydraulic Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cfdbec'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e4efff'
  surface-container-high: '#dde9fb'
  surface-container-highest: '#d7e4f5'
  on-surface: '#101c29'
  on-surface-variant: '#414752'
  inverse-surface: '#26313f'
  inverse-on-surface: '#e9f1ff'
  outline: '#717783'
  outline-variant: '#c1c6d4'
  surface-tint: '#005faf'
  primary: '#00569e'
  on-primary: '#ffffff'
  primary-container: '#0b6ec7'
  on-primary-container: '#ebf1ff'
  inverse-primary: '#a5c8ff'
  secondary: '#556068'
  on-secondary: '#ffffff'
  secondary-container: '#d9e4ee'
  on-secondary-container: '#5b666e'
  tertiary: '#006246'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d5a'
  on-tertiary-container: '#beffdf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a5c8ff'
  on-primary-fixed: '#001c3a'
  on-primary-fixed-variant: '#004786'
  secondary-fixed: '#d9e4ee'
  secondary-fixed-dim: '#bdc8d1'
  on-secondary-fixed: '#121d24'
  on-secondary-fixed-variant: '#3e4850'
  tertiary-fixed: '#86f8c9'
  tertiary-fixed-dim: '#68dbae'
  on-tertiary-fixed: '#002115'
  on-tertiary-fixed-variant: '#00513a'
  background: '#f8f9ff'
  on-background: '#101c29'
  surface-variant: '#d7e4f5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  numeric-metric:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system targets warehouse inventory operators, distribution floor managers, and logistics staff operating under harsh warehouse lighting, dynamic physical movement, and rapid throughput demands.

The visual ethos blends **Corporate Modern utility** with **Industrial Tactile Ergonomics**:
- **Immediate Legibility:** Crisp contrast ratios well beyond standard accessibility minimums to withstand glare, dust-laden screen protectors, and forklift mounts.
- **Utilitarian Balance:** Clean, functional surfaces void of extraneous decorative styling. Form strictly tracks operational speed and accuracy.
- **Confident Authority:** Deep navy typography grounded by crisp structural grids and vibrant hydraulic blue accents to signify cold-chain freshness, water purity, and operational reliability.

## Colors

The palette establishes an unambiguous hierarchy engineered for split-second status identification on industrial ruggedized handhelds and mounted tablets.

- **Primary (`#0B6EC7`):** Aqua Blue drives active states, focal navigation, primary transactional actions, and focus rings.
- **Secondary (`#E6F1FB`):** Soft Blue Tint serves as tinted card containers, non-critical highlight panels, and selected item backdrops.
- **Tertiary / Status Safe (`#1D9E75`):** Reserved strictly for verified quantities, ready-to-dispatch manifests, and full stock status.
- **Warning / Low (`#E08A00`):** Communicates reorder thresholds, pending inspection, and partial allocations.
- **Critical / Depleted (`#D64545`):** Flags stockouts, quarantine zones, batch discrepancies, and critical stop actions.
- **Neutral Core:** `#F8FAFC` base background provides anti-glare canvas separation against pure `#FFFFFF` primary container cards. Texts leverage deep slate `#0F172A` (14.2:1 contrast against `#FFFFFF`) and secondary slate `#5F6B7A` for metadata and unit measurements.

## Typography

Inter was selected for its neutral geometric clarity, tabular numeric features, and tall x-height. 

- **Tabular Figures (`tnum`):** Enforce monospace numeric rendering across SKU tallies, pallet IDs, volume gauges, and barcode readouts to prevent layout shifts.
- **Weight Calibration:** Avoid weights below `400`. Body copy defaults to `500` (Medium) on small handheld viewports to combat wash-out caused by low-quality backlit terminal displays.
- **Uppercase Usage:** Strict uppercase styling is limited to `label-sm` badges (e.g., status pill tags, SKU batch prefixes, warehouse aisle coordinates).

## Layout & Spacing

The layout uses a multi-tier fluid grid anchored by ergonomic touch geometry:

- **Mobile / Handheld Scanner (<768px):** 4-column fluid system. Gutter is `1rem`, outer margins are `1rem`. Fixed primary viewport navigation settles into an ergonomic 64px tall bottom navigation dock with gloved-finger spacing.
- **Tablet / Vehicle Terminals (768px - 1199px):** 8-column layout. Gutter scales to `1.25rem`. Margins adjust to `1.5rem`. Split panes decouple list/item views for rapid pick-and-pack workflow.
- **Desktop / Logistics Station (>=1200px):** 12-column layout with a persistent 280px left rail. Margins scale to `margin-desktop` (`2rem`) with `gutter-desktop` (`1.5rem`).
- **Touch Boundaries:** All interactive components enforce a hard minimum hit area of 48×48px (`3rem`), even when the visual container inside is smaller.

## Elevation & Depth

To prevent optical muddiness in industrial warehouse lighting, this design system rejects heavy, fuzzy drop shadows in favor of **Tonal Layering backed by Low-Contrast Structural Outlines**:

- **Canvas (Level 0):** `#F8FAFC` base ground.
- **Container / Primary Cards (Level 1):** `#FFFFFF` surface bordered by a crisp `1px solid #E2E8F0` stroke. Zero shadow in standard state.
- **Tinted Containers / Secondary Highlights (Level 1-Tint):** `#E6F1FB` surface bordered by `1px solid #BAE0FD`.
- **Floating Modals, Drawers & Scanners (Level 2):** `#FFFFFF` surface bordered by `1px solid #CBD5E1`, elevated via an ambient shadow: `0 8px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)`.
- **Active Scanning / Drop-Target Overlays (Level 3):** `#FFFFFF` backed by `0 16px 36px -6px rgba(11, 110, 199, 0.20)`, bordered by `2px solid #0B6EC7`.

## Shapes

The interface embraces a structured, industrial roundedness (`roundedness: 2`):

- **Interactive Core (Inputs, Buttons, Segmented Blocks):** `0.5rem` (8px). This creates distinct touch affordance boundaries without devolving into playful or juvenile forms.
- **Large Cards & Modals (`rounded-lg`):** `1rem` (16px) perimeter curvature to visually bundle dense item grids.
- **Status Pills & Count Badges:** Fully circular (`rounded-full` / `9999px`) to immediately set status metadata apart from squared action targets.

## Components

### Buttons
- **Primary:** Filled `#0B6EC7`, text `#FFFFFF`, minimum height 48px, horizontal padding `1.25rem`. Hover `#0959A3`, active `#074580`.
- **Secondary / Utility:** Filled `#E6F1FB`, text `#0B6EC7`, `1px solid #BAE0FD`.
- **Destructive:** Filled `#D64545`, text `#FFFFFF`.
- **Focus Indicators:** Unclipped `3px` outline with `#0B6EC7` offset by `2px` white barrier.

### Status Chips & Badges
- **Safe (In Stock):** Background `#ECFDF5`, text `#0F5B41`, dot indicator `#1D9E75`.
- **Warning (Low Stock):** Background `#FFFBEB`, text `#8A4C00`, dot indicator `#E08A00`.
- **Critical (Depleted / Damaged):** Background `#FEF2F2`, text `#991B1B`, dot indicator `#D64545`.
- Text is styled with `label-sm` tracking and font weight 700.

### Segmented Controls
- Contained within an outer `#F1F5F9` tray, padding `4px`.
- Active segment: `#FFFFFF` pill, `1px solid #CBD5E1`, shadow `0 1px 3px rgba(15, 23, 42, 0.08)`, text `#0F172A`.
- Inactive segment: Transparent background, text `#5F6B7A`. Target heights locked to 44px.

### Inputs & Barcode Trigger Fields
- Height 48px, background `#FFFFFF`, border `1.5px solid #CBD5E1`.
- Suffix includes a dedicated high-contrast scan icon button (`#0B6EC7` icon, min 44×44px hit-box).
- Active focus state: Border color changes to `#0B6EC7` with an auxiliary `0 0 0 3px rgba(11, 110, 199, 0.15)` ring.

### Cards & Quick Stock Indicators
- Standard inventory row card: Height variable, minimum touch height 64px, background `#FFFFFF`, border `1px solid #E2E8F0`.
- Includes a dedicated 6px left vertical status strip indicator matching status tokens (Safe: `#1D9E75`, Low: `#E08A00`, Critical: `#D64545`).
- Right-aligned quantity block displays real-time inventory count using `numeric-metric` typography.

### Checkboxes & Radios
- Size: 24×24px (enclosed within a 48×48px transparent touch boundary).
- Unselected: Border `2px solid #94A3B8`, background `#FFFFFF`.
- Selected: Background `#0B6EC7`, border `#0B6EC7`, bold white checkmark/dot.