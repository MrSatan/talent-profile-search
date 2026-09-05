# React Frontend

Related documents: [`README.md`](README.md), [`backend-nestjs.md`](backend-nestjs.md), and [`pipelines.md`](pipelines.md).

## Responsibilities

The React application provides one focused profile-search page with:

- Keyword search.
- Skill selection.
- Job-title filtering.
- Location filtering.
- Result count and result cards.
- Pagination.
- Loading, updating, empty, failure, and retry states.
- Responsive and keyboard-accessible interactions.
- An internal professional profile page with full skills, experience, education, industry, and summary.

It must not perform local profile filtering or store the complete dataset in the browser.

## Technology

- React with TypeScript.
- Vite.
- TanStack Query for server state.
- Native URL search parameters for committed search state.
- Custom CSS with variables for a small design system.
- React Testing Library and Playwright.

Do not add Redux. The page has local input state, URL state, and server state, none of which require a global store.

## Suggested Structure

```text
src/
  main.tsx
  app.tsx
  api/
    client.ts
    contracts.ts
  components/
    error-state.tsx
    pagination.tsx
  features/search/
    profile-search-page.tsx
    search-toolbar.tsx
    filter-panel.tsx
    skill-combobox.tsx
    profile-list.tsx
    profile-card.tsx
    search-params.ts
    queries.ts
  styles/
    tokens.css
    global.css
```

Keep components local to the search feature until another feature genuinely reuses them.

## State Pipeline

```text
User input
  -> local draft value
  -> debounce keyword and title
  -> update URL search parameters
  -> derive TanStack Query key
  -> cancellable API request
  -> render request state
```

The committed state lives in the URL:

```text
/?q=engineer&skills=typescript&skills=postgresql&title=senior%20engineer&location=austin&page=2
```

This supports refreshes, sharing, browser navigation, and deterministic browser tests.

Rules:

- Changing keyword or filters resets `page` to 1.
- Skill and location selections update immediately.
- Keyword and title inputs use a short debounce.
- Browser back and forward update controls and results.
- Unknown URL parameters are ignored by the frontend and rejected if sent to the API.
- Multi-value filters use repeated URL parameters. Read skills with `URLSearchParams.getAll('skills')` and send the same repeated `skills` keys to the API; comma-separated values and the singular `skill` key are not part of the contract.

## Request Handling

TanStack Query keys must include every committed search parameter. Pass its abort signal to `fetch` so stale requests are cancelled.

Keep previous results visible while changing pages, but indicate that the results are updating. Retry temporary server failures once and provide an explicit retry button after failure.

Facet counts are contextual: they reflect the committed keyword and all active filters. They describe the currently visible result set rather than predicting counts after removing a filter.

The browser calls relative `/api` URLs. Vite proxies these requests in development, and Nginx proxies them in the Docker image.

## Result Cards

Cards may display:

- Full name.
- Current title.
- Company.
- Broad location.
- Years of experience.
- A bounded number of skills.
- Keyword-matching skills promoted into view, with a Show/Hide control for the complete skill list.
- A compact list of fields that explain a keyword match, including short evidence excerpts for hidden professional fields.
- A short summary excerpt.
- LinkedIn profile link.

Cards must not display email, phone, street address, birth information, gender, or salary.
Match explanations render sanitized professional excerpts as React text. They never render Elasticsearch markup or forbidden personal fields.

Each card is a full-card link to `/profiles/:id`, which loads the complete professional record from PostgreSQL. The visible link supplies the card-sized pointer target and keyboard focus while the independent skill-disclosure button remains operable above it. The link carries the current search URL as a validated local return path, so Back to search restores the previous keyword, filters, and page. LinkedIn remains a separate external action on the detail page.

## Layout

Desktop uses a compact filter rail and a wider results column. Mobile moves filters into an accessible dialog or disclosure panel.

```text
+--------------------------------------------------+
| Product identity | Keyword search                |
+------------------+-------------------------------+
| Filters          | Count and active filters      |
|                  | Profile result                |
|                  | Profile result                |
|                  | Pagination                    |
+------------------+-------------------------------+
```

The brief prioritizes logic over decoration. Visual design should be restrained, distinctive, and readable rather than dashboard-heavy.

## Required UI States

| State | Behavior |
| --- | --- |
| Initial | Show a paginated browse view or clear search invitation |
| Loading | Show stable skeleton geometry |
| Updating | Preserve results and show subtle progress |
| Success | Show count, active filters, cards, and pagination |
| No results | Explain which filters can be cleared |
| API failure | Show concise error and retry action |
| Empty skill suggestions | Explain that no matching skill exists |

## Accessibility

- Use a real `form` or `role="search"` for search controls.
- Associate every input with a visible label.
- Preserve visible keyboard focus.
- Give the skill combobox correct combobox and listbox semantics.
- Announce changed result counts through a polite live region.
- Make filter removal buttons understandable to screen readers.
- Respect `prefers-reduced-motion`.
- Keep touch targets large enough on mobile.

## Security

- Render API values as React text, not raw HTML.
- Do not use `dangerouslySetInnerHTML` for Elasticsearch highlights.
- Validate external LinkedIn links before rendering them.
- Use `rel="noreferrer"` for new-tab external links.
- Do not log search results or API payloads in production.

## Testing

Component tests cover URL parsing, query generation, loading, empty, error, retry, filter reset, and pagination behavior.

Playwright covers a complete keyword plus skill plus title search, verifies URL state, and confirms the expected synthetic profile appears. A second scenario checks the 375 px layout in dark mode with reduced motion, including the mobile filter disclosure, touch sizing, and horizontal overflow.
