# Documentation spaces and pages

The former Wiki module is now displayed as **Documentation**. It uses a space overview,
a page tree, nested pages, breadcrumbs and a reading view with a table of contents.
The organization follows the spaces and parent/child pages described in
[Atlassian's Confluence documentation](https://support.atlassian.com/confluence-cloud/docs/organize-your-space/).
Existing articles, categories and links remain intact.

## Using the module

- **Overview:** browse spaces and recently edited pages; create a page or manage spaces.
- **Spaces:** create, rename and describe a space. Existing categories become spaces
  without duplicating their data. Pages may also remain outside a space.
- **Pages:** search and sort by title or date. The sidebar selects a space and displays
  its page tree. Collapse branches; opening a child expands its ancestor path. The tree
  shows up to 250 entries, prioritizing the selected path. Search covers all pages.
- **Read:** breadcrumbs show the space and ancestors; child pages appear below the content.
  Heading buttons scroll inside the page without replacing the application's hash route.
- **Edit:** choose a space and parent, write Markdown with a formatting toolbar, and switch
  to preview. Supported: headings, bold, italic, inline/code blocks, lists, quotes, tables
  and HTTP(S)/mailto links. Raw HTML remains text; unsafe link schemes are not activated.
- **Templates:** start an empty new page with a how-to, decision record or meeting notes.
  Template text follows the current UI language. Existing content is never replaced by a
  template, and changing UI language preserves text already entered.

Saving uses existing workspace synchronization and notifications. Unsaved page drafts
remain in the current session across navigation/module changes and clear at an account
change or reload. Stale drafts cannot overwrite a page changed since editing began.
Open drafts/dialogs block AI confirmations. Content remains account-scoped.

Future extensions: page revision history, comments, shared spaces, collaborative editing,
labels and attachments specifically belonging to documentation pages.

## Hierarchy rules

`WikiArticle.parentId` is optional and nullable; `null` means a root page. A parent must
exist in the same account and space, including the unassigned space. Cycles and more than
twelve levels are rejected by frontend and backend. Page IDs remain stable.

The editor excludes the current page and descendants from the parent selector. Moving a
page within its space retains its children. A page with children keeps its space until
the children have been moved, preventing hidden cross-space changes. Deleting a page with
children is rejected: move or remove them first. Deleting a space reassigns its pages to
another or the unassigned space and retains hierarchy and content.

## Storage and compatibility

Routes stay `#/wiki/home`, `#/wiki/articles`, `#/wiki/categories` and `#/wiki/search`.
`?article=<ID>` opens a page; `?edit=<ID>` edits it; `?edit=new&parent=<ID>` starts a child;
`?category=<ID>` selects a space. APIs retain `wiki.articles` and `wiki.categories`.

Flyway **V8__documentation_page_hierarchy.sql** adds nullable `ff_wiki_articles.parent_id`,
an index and a composite `(owner_id, parent_id)` foreign key to the same account's pages.
Existing pages remain roots. No dependency, installation or environment variable is added.
The normal PostgreSQL backend start applies the migration automatically.

Updates remain atomic multipart `PUT /api/v1/workspace` requests with revision/If-Match,
authentication, origin and CSRF checks. An older HTTP client omitting parentId preserves an
existing parent; explicit null moves to the root. The compatibility read occurs only for
omitted fields and checks the same revision before saving.

JPA validates the hierarchy, detaches old self-references inside the transaction, and writes
parents before children in batches by depth while preserving collection order. Failed writes
roll back hierarchy, content and revision. Memory uses the same validation but is volatile.

An old backend downgrade can flatten hierarchy on its next write and cannot read the new
AI conversation format. Assess the deployment script's backups and data preservation before
any downgrade. Do not manually revert migration history or restore over live data.

## AI integration

Existing seven tool names and confirmation protocol remain. `articles` means pages and
`categories` means spaces. Read queries accept parentId/categoryId filters; counts and
pagination remain bounded. Creating with `parent` (exact name/#ID) inherits its space when
category is omitted. Updating `parent` moves the page; an empty value moves to the root.
Hierarchy rules apply both to proposals and confirmed transactions.

Examples: “List child pages of page #9”, “Create a deployment guide below page #9”, or
“Move page #12 to the root of its space”. Selected page identity is absent from the AI
context, so ambiguous “this page” requires clarification. Editor text remains private
until saved or explicitly entered into chat. Chat text alone never approves a write.

Mutation records containing parentId use internal conversation format **5**; the backend
reads formats 1–5. Limits, immutable cards, ownership, expiry, idempotency and rollback remain.

## Verification

Automated checks cover cycles/depth/space constraints, legacy decoding and HTTP omissions,
explicit root moves, ownership, foreign keys, parent-first insertion, existing-content
migration, persistence across backend instances, atomic AI rollback/retry, Markdown safety,
links, collapse, breadcrumbs, table-of-contents scrolling, templates, toolbar, drafts and IDs
allocated after external changes. Manual acceptance is in [browser-check.md](browser-check.md).
Automated component checks do not constitute visual browser acceptance.
