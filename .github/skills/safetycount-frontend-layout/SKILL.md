---
name: frontend-layout
description: Use when implementing or refactoring the SystemName React app shell, including header, sidebar, content layout, route shells, responsive navigation, and page container structure.
metadata:
  short-description: SystemName app shell and layout rules
---

# Frontend Layout

Use this skill when building or refactoring the main application layout in
`SystemName-web`. It captures the layout contract already present in the
project so new pages follow one shell instead of creating page-specific
structure.

Base this skill on the current source of truth:

- `src/App.jsx` owns the route shell and renders pages through `AppLayout`.
- `src/components/layout/AppLayout.jsx` owns the global header and content
  scroll region.
- `src/components/layout/Sidebar.jsx` owns brand, primary navigation, mobile
  drawer behavior, and active route styles.
- Page components own their own toolbars, cards, filters, and tables inside the
  content region.

## When To Use

Use this skill when you need to:

- add a new top-level page to the app
- redesign the header, sidebar, or main content shell
- improve mobile navigation or overlay behavior
- standardize spacing and scroll behavior across pages
- review whether a page is putting layout responsibilities in the wrong place

Do not use this skill for login screens, marketing pages, or standalone embeds
that intentionally do not use the authenticated app shell.

## Shell Architecture

The app should keep a single route shell and swap page content through
`<Outlet />`.

- Keep one shared layout wrapper in `AppLayout`.
- Register top-level routes in `src/App.jsx` under the shared layout route.
- Do not duplicate header or sidebar inside individual pages.
- Treat `AppLayout` as app chrome and each page component as the working area.

Recommended structure:

```jsx
<BrowserRouter>
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/..." element={<Page />} />
    </Route>
  </Routes>
</BrowserRouter>
```

## Header Guidelines

The header is for lightweight global context, not page-level workflows.

- Keep the header height stable at `h-16`.
- Left side should contain the mobile sidebar trigger and the current page title.
- Derive the page title from `PAGE_TITLES` in `AppLayout.jsx` — one map, one
  place. Never derive or override the title inside a page component.
- Right side should contain low-noise global context such as the current date,
  environment label, or small system status.
- Keep the header surface light and consistent: border bottom, white surface,
  subtle transparency only if the rest of the shell uses it.
- If a page needs filters, bulk actions, search, or tabs, place them inside the
  page content area, not in the global header.

Avoid:

- putting dense toolbars into the global header
- giving different pages different header heights
- adding a route to the sidebar without also adding it to `PAGE_TITLES`

## Sidebar Guidelines

The sidebar is for app-level navigation only.

- Define navigation as data objects with `to`, `label`, and `icon` in `NAV_ITEMS`.
- Keep the sidebar width fixed at `w-64` so content layout stays predictable.
- Use `end={item.to === '/'}` for exact matching on the dashboard so it does not
  appear active on every route.
- Keep three vertical zones: brand (`h-16`) at top, scrollable nav in the middle,
  footer/meta at bottom.
- On desktop (`lg:` and above), the sidebar is `static` and always visible.
- On mobile, the sidebar is `fixed inset-y-0 left-0` and slides in as a drawer
  using a translate transform.
- The overlay uses `z-40`; the sidebar drawer uses `z-50`.
- Clicking the overlay or a nav item should close the mobile drawer.
- Active state uses `bg-indigo-600/20 text-indigo-400` on the link and
  `text-indigo-400` on the icon together.

**NAV_ITEMS / PAGE_TITLES sync rule**: Every route that appears in `NAV_ITEMS`
must also have an entry in `PAGE_TITLES`. Omitting one causes the header to fall
back to the generic "SafetyCount" string on that page.

Avoid:

- using the sidebar for page-local tabs or filters
- allowing multiple items to look active from loose route matching
- mixing primary navigation with temporary workflow actions

## Content Area Guidelines

The content region is where each page does real work.

- Keep the shell at viewport height with `h-screen overflow-hidden bg-slate-50`.
- Make `<main>` the only vertical scroll container: `flex-1 overflow-y-auto`.
- Use consistent content padding: `p-4 sm:p-6`. Do not override this inside
  individual pages.
- The page body inside `<main>` is wrapped in `<div className="animate-fade-in">`
  — do not add a second outer animation wrapper inside the page component.
- Use page-level spacing with `space-y-5` or `space-y-6` as the root class of
  each page component.
- Let each page own its own top row for actions, counts, filters, and search.
- Keep page sections flat and readable; avoid wrapping the entire page in one
  oversized decorative card.
- Loading, empty, and error states should render inside the content region where
  the final data will appear.
- Use local horizontal overflow only for dense surfaces like tables.

Avoid:

- nested vertical scroll containers without a strong reason
- duplicating padding logic differently on every page
- placing page business logic in the shell component

## Responsive Rules

The current layout already assumes two navigation modes.

- Below `lg`, use a hamburger trigger and off-canvas sidebar.
- At `lg` and above, keep the sidebar statically visible.
- Keep action bars inside pages flexible with `flex-wrap` so they survive narrow
  widths.
- Prefer `min-w-0` on flexible content columns when tables or long text can push
  the shell wider than the viewport.
- The overlay should sit below the drawer and above page content.
- Page content should remain independently scrollable when the drawer is open.

## Visual Language To Preserve

Follow the existing shell tone unless the app is being intentionally re-themed.

- Use Tailwind utility classes as the primary styling approach.
- Keep the shell palette in the current slate and indigo family.
- Use borders, spacing, and typography for structure before adding more color.
- Use animation sparingly and at container level, such as `animate-fade-in` on
  a page body rather than many nested animated elements.
- Keep iconography simple and consistent with the existing outline/solid SVG
  style already in use.

## Rules For Adding A New Top-Level Page

When adding a new app page, update all layout touchpoints together:

1. Create the page component in `src/pages/`.
2. Add the route under `AppLayout` in `src/App.jsx`.
3. Add the page title entry in `PAGE_TITLES` in `AppLayout.jsx`.
4. If the page should be globally reachable, add a nav item to `NAV_ITEMS` in
   `Sidebar.jsx` with the same path string used in steps 2 and 3.
5. Start the page JSX with `<div className="space-y-5">` or `space-y-6`.
6. Verify desktop and mobile behavior, especially that the drawer closes when
   navigating to the new page.

## Review Checklist

Before finishing layout work, check these points:

- There is only one header and one sidebar implementation for shell pages.
- The current route title is defined centrally.
- The mobile drawer can be opened and closed without trapping the page.
- Only one region is responsible for the main vertical scroll.
- Page actions live in the page body, not in the global header.
- New pages do not introduce a different shell spacing system.
- Active nav highlighting is correct for `/` and non-root routes.

## Output Standard

The final result should feel like one cohesive application shell:

- navigation is stable
- header context is minimal and readable
- content pages own their workflows cleanly
- responsive behavior does not require special-case layouts per page
- new screens can be added by extending the shell, not replacing it