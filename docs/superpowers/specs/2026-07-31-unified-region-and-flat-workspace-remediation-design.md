# Unified Region and Flat Workspace Remediation Design

## Objective

Make the enterprise prototype operate from one authoritative regional context,
expose the complete in-scope geography for Qiqihar, Heihe, and the four
designated Hulunbuir jurisdictions, remove residual dashboard-like composition
from operational pages, and keep governance rules enforced without repeating
system-design prose in daily workspaces.

## Scope

The monitoring geography is:

- Qiqihar: the full city account plus 7 districts, Nehe City, and 8 counties.
- Heihe: the full city plus Aihui District, Bei'an City, Wudalianchi City,
  Nenjiang City, Sunwu County, and Xunke County.
- Hulunbuir designated scope: Zhalantun City, Arun Banner, Morin Dawa Daur
  Autonomous Banner, and Oroqen Autonomous Banner.

Township and administrative-village totals remain separate evidence-bearing
attributes. A number is displayed only when a 2025–2026 official source has
been verified; otherwise the interface displays `待核定`. Natural villages are
out of scope.

Primary references checked for this scope:

- Heihe municipal overview:
  https://www.heihe.gov.cn/hhs/c102596/202305/c11_248649.shtml
- Hulunbuir municipal overview:
  https://www.hlbe.gov.cn/News/show/926378.html

## Architecture

`enterpriseRegions.ts` is the only source for region identifiers, labels,
hierarchy, business availability, and official-source status. Workspaces store
only a region identifier and resolve all display text from this model.

The page-level context row contains the interactive region field. Production,
market, supply-demand, business reports, and duty supervision consume the same
option groups. A region with no formal supply account remains selectable and
shows an explicit unavailable-account state instead of fabricated zero values.

## Operational Layout

Operational pages use this order:

1. Page title and primary actions.
2. Workflow tabs where the business has distinct status queues.
3. One compact filter row containing region, object type, product, period,
   status, and version where applicable.
4. One borderless inline status row.
5. One dominant table or form workspace.
6. Pagination and secondary details after the primary table.

Large metric cards and stacked product/quality/status bands are removed from
operational pages. The executive overview may retain a single compact inline
summary because it is an aggregation surface rather than a transaction surface.
Concrete varieties and their applicable quality fields remain visible in the
dominant table instead of being split into separate dashboard bands.

## Rule Presentation

Rules continue to be enforced by authorization, validation, workflow, and
audit logic. Daily pages show only:

- the current permission or status;
- the deadline;
- the blocking reason;
- the action the user can take.

Long explanations such as non-overwrite behavior, account calculation policy,
and delegation policy move into collapsed `details` help or administrative
configuration. The duty-supervision landing page no longer shows a permanent
rule table.

## Acceptance Criteria

- Every business region selector contains all three top-level scopes and all
  in-scope county-level jurisdictions.
- Selecting Heihe or a designated Hulunbuir jurisdiction changes the visible
  region context in production, market, reports, and duty supervision.
- Supply-demand shows complete Qiqihar account availability and exposes Heihe
  and Hulunbuir selections without inventing balances.
- Qiqihar contains all 16 county-level jurisdictions.
- No natural-village label appears.
- Operational overview pages no longer render `WorkspaceSummaryStrip`.
- Duty rules are available on demand but are not expanded in the primary
  supervision workspace.
- Existing product, variety, quality, collection, review, report, and audit
  functions remain present.
