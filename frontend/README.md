# Lambe Frontend

React 19, TypeScript, and Vite frontend. Source code is organized by feature so
each business area owns its API calls, components, hooks, and types.

## Source structure

```text
src/
  app/                     Application setup, providers, and routing
  assets/                  Imported images, fonts, and static assets
  components/
    layout/                Shared page shells and navigation
    ui/                    Reusable interface primitives
  features/
    auth/
      api/                 Authentication requests
      components/          Auth-specific components
      hooks/               Auth-specific state and behavior
      types/               Auth request/response types
    booking/
      api/                 Booking and service requests
      components/          Booking-specific components
      hooks/               Booking-specific state and behavior
      types/               Booking request/response types
  hooks/                   Hooks shared across features
  lib/                     Configured third-party clients
  services/                Shared integrations and infrastructure
  styles/                  Global styles and design tokens
  types/                   Shared application types
  utils/                   Small, reusable pure functions
```

Keep code used by one business feature inside that feature. Promote it to the
shared folders only when multiple features use it. Keep route composition and
application-wide providers in `app/`.

## Brand system

Global color, typography, spacing, grid, radius, and elevation tokens live in
`src/styles/tokens.css` and are loaded by `src/index.css`. The official logo is
available as `src/assets/lambe-logo.svg` for components and
`public/lambe-logo.svg` for browser metadata and static usage.

Use the semantic CSS variables such as `--color-primary-container`,
`--color-surface-container-low`, and `--color-on-surface` instead of adding
one-off color values. Shared layout and common form/button primitives are
defined in `src/index.css`.

## Commands

```bash
npm run dev
npm run build
npm run lint
```
