# Optimize Wiki

Optimize Wiki is the built-in company knowledge area at the bottom of the sidebar. Staff can create, read, edit, and search Markdown pages. It starts empty: add verified company facts, product references, support guidance, and operating procedures rather than assumed policies.

The Wiki belongs to the connected Optimize host and is available across that host's projects. Multiple devices connected to that host use the same Wiki. Separate hosts have separate Wikis; the host picker chooses which one is open. This version does not provide cloud synchronization or per-page access roles.

## Storage and recovery

Pages are UTF-8 JSON files under the Optimize data directory, normally `~/.optimize/wiki/<page-id>.json`. Each file contains the title, Markdown body, ID, revision, and creation/update timestamps. This directory is runtime company data, outside the source repository. Include it in the host's backup policy; updating the app does not replace it.

Writes are atomic and serialized per host directory. An edit must carry the revision it opened. Conflicting edits return an error and keep the draft in the editor; copy the draft before cancelling and reopening the page to compare the latest version. Previous revisions are retained under `wiki/history/<page-id>/` for administrator recovery. There is currently no in-app history browser, deletion, automatic import, or document attachment indexing.

Titles support 160 characters and bodies 100,000 characters. Search matches all supplied words across titles and bodies, ranks title matches first, and paginates 50 results at a time. Read errors are surfaced instead of being reported as an empty Wiki. Page IDs cannot escape the Wiki directory, and symbolic-link page reads are refused.

## Assistant access

The assistant receives Wiki access guidance alongside the editable company instructions on new or reloaded runtime sessions. Company and project instructions retain their existing scopes. The guidance is regenerated when company instructions change.

Two read-only host tools are registered through the existing agent tool catalog:

- `optimize_wiki_search`: current page titles, matching excerpts, IDs, dates, and the next search offset.
- `optimize_wiki_read`: the latest saved content of a selected page.

The assistant is instructed to consult relevant pages for company questions and cite their exact titles as “Optimize Wiki — <title>”. Page content is reference material, not system authority. It cannot authorize actions or override company/project instructions. If host tools are disabled, the prompt identifies the current page directory for the assistant's file-reading tools; inaccessible context must be reported as unavailable. Historical revisions are excluded from current context.

The app uses additive `wiki.search`, `wiki.read`, and `wiki.write` request/response pairs, gated by `server_info.features.optimizeWiki`. Existing `workspace.read` permission permits reading/search; `workspace.write` permits edits. No new unauthenticated endpoint is introduced. AI tool availability follows the existing host tool policy.

## Validation

Store tests cover persistence, content search, host isolation, pagination, stale/concurrent saves, revision recovery, corrupt data, invalid IDs, symlinks, and input limits. Editor model tests cover preserved drafts and duplicate-submit protection. The Mac build also exercises the real packaged sidebar, page creation, editing, full-text search, persisted contents, and reopening after a renderer reload.

## Connected articles

Articles can live inside other articles. The containing article becomes an overview page with an automatically generated list of subpages. The home page lists top-level articles, and breadcrumbs show where the current article belongs. Invalid moves into the same article or one of its descendants are rejected. Existing articles keep their IDs and content when upgraded.

Use `[[Article title]]` to refer to an unambiguous title, or insert a link through the editor to save `[[page-id|label]]`. ID links survive title changes. Unknown or ambiguous title links are shown as unresolved. Backlinks list articles pointing at the current page. Headings create a clickable table of contents; code fences are excluded. The editor supports free Markdown, heading/bold/list/table insertion, page linking, and preview.

The graph combines article links and hierarchy. Search includes each matching article's neighbors. It displays up to 80 articles at a time; search narrows larger Wikis. The index supports up to 10,000 articles and reports an explicit limit error beyond that. Full-text article search remains paginated. The graph/index feature is gated once by `optimizeWikiGraph`; older hosts must be updated.

Open Wiki views refresh every 10 seconds while active. Drafts keep their opened revision. A conflicting edit fails visibly instead of overwriting another employee's changes. This is shared storage with conflict detection, not simultaneous editing of the same paragraph.

## Team rollout

Use one central Optimize host for the company Wiki and point the staff apps at it. The host owns storage, search, and assistant access; staff apps edit and read that same source. Local host copies are independent. Do not put live JSON files in a consumer sync folder as a substitute for coordinating writes.

The existing host supports authenticated device principals, revocable credentials, and daemon-wide grants. `workspace.read` permits Wiki reading, `workspace.write` permits editing, and `daemon.manage` controls harness configuration. These grants also cover other workspace or host operations; they are not dedicated Wiki roles. See [permissions](permissions.md).

For a wider company rollout, add company identity/sign-in, employee provisioning and revocation, dedicated Wiki permissions enforced by every read/write/index path and AI retrieval, backups with a tested restore, and audit history showing the editor. Choose the central hosting location and retention policy with Optimize. None of these organizational settings are silently provisioned by installing the Mac app. Per-page restrictions and simultaneous collaborative editing remain future work.

## Engineering

Settings → Engineering groups company/project instructions, context sources and tools, agent profiles and skills, models, and extensions. Existing deep links into agent/model/plugin settings still reach the corresponding engineering area. Context rules are configured through company/project instructions and the available source/tool switches; this release does not add a separate retrieval ranking or token-budget engine.
