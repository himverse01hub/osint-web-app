# Haryana Police OSINT Platform

## 1. Document Purpose

This document captures the rough product and technical requirements for the Haryana Police OSINT web application.

The platform is intended for authorised investigators to collect, search, organise, relate, and report on publicly available intelligence and internally recorded investigation data.

## 2. Product Goals

- Provide one secure workspace for OSINT investigation activity.
- Search public data sources and display source-aware results.
- Store investigator-created entities, cases, relationships, alerts, and search history in PostgreSQL.
- Connect suspects and related entities through a knowledge graph.
- Support case summaries, suspect profiles, audit visibility, and intelligence reports.
- Keep the interface responsive and usable on desktop and tablet screens.

## 3. Users and Roles

### Investigator

- Perform OSINT searches.
- View suspect profiles and relationships.
- Create and update investigation cases.
- Add entities and relationships.
- Generate intelligence reports.

### Analyst

- Review search results and investigation records.
- Analyse relationships and knowledge graph data.
- Support report preparation.

### Supervisor

- Review cases, reports, alerts, and investigator activity.
- Monitor priority and status summaries.

### Administrator

- Manage investigator accounts.
- Add, edit, and remove users.
- Manage operational records and application data.

Access should be controlled by authenticated sessions and role permissions. All use is restricted to authorised investigative work and applicable law and policy.

## 4. Functional Requirements

### 4.1 Authentication and User Management

- Users shall be able to log in and log out using username and password.
- The application shall maintain a server-side session using a secure cookie.
- The application shall provide a current-user/profile endpoint.
- Administrators shall be able to add, edit, and delete investigator profiles.
- A user shall be able to update their own profile and preferences.
- A user shall be able to permanently delete their own profile after confirmation and shall then be signed out.
- Passwords shall be stored as password hashes, never as plain text.

### 4.2 Dashboard

- Show live counts for entities, relationships, cases, and alerts.
- Show recent searches, limited to the latest three records.
- Show active/open case counts grouped by priority: critical, high, medium, and low.
- Allow quick creation of a case.
- Allow suspects to be selected while creating a case.
- Refresh live data without requiring a full application rebuild.

### 4.3 OSINT Search

- Support searches by person, phone, email, username, organisation, location, cryptocurrency wallet, and all types.
- Query live providers where configured, including OpenStreetMap, Wikidata, Wikipedia, and GDELT.
- Display the source name, source URL, confidence, tags, and discovery time where available.
- Display source-specific errors without failing the complete search when one provider is unavailable.
- Apply a bounded timeout to slow providers.
- Save search runs and discovered external entities to the database.
- Do not use fabricated mock search results in the production application.

### 4.4 Investigations and Cases

- Show investigation totals by priority rather than exposing complete case listings on the summary page.
- Provide search/filter by priority, status, case number, and title.
- Provide a separate Data Management entry from the Investigations area.
- Create, update, and delete cases through the API.
- Store case number, title, description, status, priority, assignee, tags, timestamps, and linked entities.
- Support case statuses: open, active, closed, and archived.
- Support priorities: low, medium, high, and critical.
- Allow suspects/person entities to be linked to a case.
- Allow case detail pages to show and manage the selected case.

### 4.5 Data Management

Data Management shall be accessible from Investigations rather than the main Settings page.

- Add, edit, and delete entity records.
- Add and delete entity relationships.
- Create and update cases.
- Link multiple entities to a case.
- Show source, confidence, verification, tags, and relationship details.
- Persist all operational records in PostgreSQL.

Supported entity types include:

- Person
- Phone
- Email
- Username
- Organisation
- Location
- Cryptocurrency wallet
- Social account
- Vehicle
- Document

### 4.6 Suspect Profiles

- Show the selected entity's identity and metadata.
- Show linked contact details, accounts, organisations, locations, and documents.
- Show confidence, source, verification state, and discovery time.
- Show related entities and relationships.
- Link back to cases and knowledge graph views where applicable.

### 4.7 Knowledge Graph

- Provide a search field before displaying graph data.
- Do not display all stored records automatically when the page opens.
- After a search, display only matching saved entities and relationships between matching entities.
- Support focusing on a selected node.
- Provide a link to the selected entity profile.
- Do not display mock nodes, mock edges, random demo data, or placeholder graph content.

### 4.8 Intelligence Reports

- Select a live case for report generation.
- Generate a report from the case's linked entities and relationships.
- Include subject overview, key findings, associated identities, online presence, relationships, leads, and sources.
- Allow PDF and other supported report exports.
- Clearly identify report generation time, case, and investigator.

### 4.9 Alerts and Audit Logs

- Display operational alerts with severity and status.
- Allow authorised users to acknowledge or update alert records.
- Display audit activity such as searches, record changes, and user activity.
- Preserve timestamps and actor information for traceability.

### 4.10 Preferences

- Persist theme, language, email-alert, and critical-alert preferences locally for the active browser profile.
- Restore saved preferences when the user returns to Settings.
- Persist profile information in the database separately from local UI preferences.
- The application language preference shall update the document language metadata.

## 5. API Requirements

The Vercel serverless API shall expose endpoints for:

- `/api/auth/*` - login, logout, current user, profile, and user management.
- `/api/search` - external and local OSINT search.
- `/api/search-history` - latest search history.
- `/api/entities` - entity CRUD and relationship reads.
- `/api/relationships` - relationship CRUD.
- `/api/cases` - case CRUD and case-file operations.
- `/api/dashboard` - dashboard counters.
- `/api/alerts` - alert operations.
- `/api/audit-logs` - audit log reads.
- `/api/assistant` - AI assistant requests.
- `/api/dark-web` - lawful dark-web intelligence records.
- `/api/health` - database/application health check.

API expectations:

- Return JSON responses with consistent error messages.
- Return `400` for invalid input.
- Return `401` for unauthenticated access.
- Return `404` for missing records.
- Return `409` for uniqueness conflicts.
- Return `503` when the database or upstream service is unavailable.
- Validate and constrain user-controlled input.
- Avoid returning passwords or password hashes.

## 6. Data Requirements

The PostgreSQL database should contain, at minimum:

- `users`
- `sessions`
- `entities`
- `relationships`
- `cases`
- `case_entities`
- `case_files`
- `alerts`
- `search_runs`
- `audit_logs`

The production deployment must define `DATABASE_URL` in Vercel environment variables. Database schema and migrations must be applied before enabling write operations.

## 7. Security and Privacy Requirements

- Restrict access to authenticated users.
- Use secure, HTTP-only session cookies in production.
- Hash passwords with a strong password hashing function.
- Do not expose credentials, tokens, or database connection strings to the frontend.
- Use parameterised database queries.
- Validate role, status, priority, entity type, and source values.
- Log important user and data-management actions.
- Use only lawfully obtained and authorised data.
- Do not claim that public-provider data is verified solely because it was returned by a provider.
- Apply retention and access policies appropriate to investigative records.

## 8. Non-Functional Requirements

- Responsive desktop and tablet layout.
- Direct routes such as `/dashboard`, `/cases`, `/graph`, `/settings`, and `/data-management` must load correctly on Vercel.
- Vercel SPA fallback must not intercept API routes.
- Slow external providers must have explicit time budgets.
- A failed external provider must not discard successful results from other sources.
- Build must pass TypeScript validation and production bundling.
- UI should provide loading, empty, success, and error states for network-backed views.

## 9. Deployment Requirements

- Frontend: Vite and React build deployed to Vercel.
- Backend: Vercel serverless functions under `api/`.
- Database: Neon PostgreSQL or compatible PostgreSQL provider.
- Required environment variable: `DATABASE_URL`.
- Production URL: https://haryana-police-osint.vercel.app
- Production smoke checks should verify the app shell, direct SPA routes, health endpoint, and read APIs after each deployment.

## 10. Out of Scope / Future Work

- Automated collection from websites that prohibit scraping or access.
- Access to illegal marketplaces, stolen databases, or private accounts.
- Fully automated suspect risk decisions.
- Background crawling without explicit investigator action.
- Advanced graph layout and visual edge rendering using a dedicated graph library.
- Fine-grained policy enforcement beyond the current role and session foundation.
- Full multilingual UI translation beyond the current preference setting.
- Production-grade report archival and digital signatures.

## 11. Acceptance Criteria

The rough requirements are considered met when:

1. An authenticated user can search supported OSINT sources and see source-labelled results.
2. Search runs and investigator-created records persist in PostgreSQL.
3. A user can create a case and link one or more person/suspect entities.
4. Investigations show searchable priority summaries without full case listings on the summary page.
5. Data Management is reachable from Investigations and no longer appears as a Settings tab.
6. Settings can save profile and preference changes.
7. An authorised user can delete an investigator profile with confirmation.
8. Knowledge Graph shows no data before an explicit search and shows only matching live records after search.
9. Direct production routes return successfully after deployment.
10. TypeScript validation and the production build complete without errors.
