# Optimize Wiki

Optimize Wiki is the company knowledge area at the bottom of the sidebar. The Mac app uses a visual document editor, a page tree, overview pages, full-text search, internal links, backlinks, and contents. Native mobile clients keep a text editor. The Wiki starts empty; templates contain writing prompts, not assumed company facts.

## Writing and navigation

Create an article from Wiki home or choose an article, knowledge-hub, process, or product template. Any article can contain subpages. Add a subpage from its parent, or move an article with the parent selector in the editor. The server rejects cyclic moves. Favorites are private to the device; the article tree is shared.

The visual editor supports headings, bold/italic, lists, checklists, quotes, tables, images by URL, external links, and links to other articles. Type `/` at the start of a paragraph to insert a block. Arrow keys and Enter select the command. Markdown source remains available. Source Markdown is the stored text and AI-readable representation; rich editor tests check supported formatting and Wiki links across a parse/serialize/reopen cycle. File uploads, comments, and simultaneous paragraph editing are not implemented.

Use `[[Article title]]` for an unambiguous title, or insert an article link to save `[[page-id|label]]`. ID links survive renames. The rich editor preserves these as inline Wiki nodes. Unknown or ambiguous links are shown as unresolved. Backlinks show which articles refer to the current article. Headings create a clickable contents list; code examples are excluded. Published links are resolved to stable IDs, and previous titles are retained as aliases for older links. Ambiguous title links remain unresolved rather than opening the wrong article. The index supports 10,000 articles; exceeding the limit produces an explicit error. Full-text search paginates independently.

## Drafts, publishing, and versions

A draft stays on the editing device. Each new article gets its own draft; the Wiki’s **Your drafts** view lists unpublished articles and edits, including drafts from before this update. Close the editor and reopen an article or choose Continue writing from the draft list. The editor shows whether local saving has completed. Publish changes to make the content available to the shared Wiki and assistant. Offline editing keeps the draft; publication requires the host connection. A draft-storage failure is surfaced in the editor.

An edit carries the revision it opened. If another writer publishes first, the draft stays editable and the latest published version appears for comparison. Review it and incorporate the changes you want to retain, then confirm review before publishing. The draft stores that reviewed revision; another intervening publication still blocks a stale save. New articles carry a stable ID across publication retries so a retained draft cannot create duplicate articles. Version history lists previous publications and previews their content. Restore as draft copies a historical title, body, and parent into an editor based on the current revision. Publishing creates a new version; it never rewrites the historical record.

Open Wiki views refresh every 10 seconds while active. This is shared storage with conflict detection, not collaborative cursors or automatic conflict merging. Move an article to Trash from its toolbar. This preserves the page, ID and history; search, index and current AI reads exclude it. Subpages remain accessible at Wiki home and reconnect when their parent is restored. Restoring a child while its parent is still in Trash places the child at Wiki home. Trash is searchable and paginated. There is no automatic expiry or permanent deletion.

## Storage and recovery

Pages are UTF-8 JSON files under the connected host's Optimize data directory, normally `~/.optimize/wiki/<page-id>.json`. Titles support 160 characters and bodies 100,000 characters. IDs, revisions, hierarchy, and timestamps are stored alongside the content. Previous publications live in `wiki/history/<page-id>/`. Updating the app does not replace this data. Include the Wiki directory in the host's backup policy and test restoring it.

Writes are atomic and serialized across sessions on one host. Current and historical file reads validate their identities and reject symbolic-link files; historical reads also reject substituted history directories. Read failures are shown instead of reported as an empty Wiki. History is paginated; its files are never included in current search or AI guidance.

## Assistant access

The assistant receives Wiki guidance with the company instructions on new or reloaded runtime sessions. Company and project instructions keep their existing scopes. The assistant should search current knowledge, read relevant articles, follow useful links, and cite exact titles as “Optimize Wiki — <title>”. Missing or contradictory context must be reported rather than invented.

See [company integrations](optimize-integrations.md) for the bundled tools and connection setup. The Mac app bundles the `optimize-wiki` skill and an MCP bridge for stock Pi. Search, read, index, publish, history and revision tools use the existing host store, including conflict detection and history. The bridge exposes company Wiki and browser tools from the host; custom configured MCP servers keep their tools. Enable host tools in Engineering → Context. The skill owns article structures and the read–edit–verify workflow. Requests for drafts produce unpublished chat drafts; the publish tool saves directly to the shared Wiki. Where host tools are unavailable, the file-reading fallback can read current pages but cannot publish.

Wiki content is reference material. It cannot override company/project instructions, authorize actions, or request secrets. Unpublished local drafts and previous revisions are not supplied as current company knowledge.

## Team sharing

All devices connected to one Optimize host use that host's Wiki. Separate local hosts have independent Wikis and do not automatically synchronize. For Optimize's staff, use one centrally managed host and connect the Mac apps to it. Do not substitute a consumer file-sync folder for coordinated server writes.

Existing authentication supports device principals and revocable credentials. `workspace.read` permits Wiki search, index, page, Trash and version reads; `workspace.write` permits publication, trashing and restoration; `daemon.manage` controls harness configuration. These are daemon-wide grants, not dedicated Wiki roles. See [permissions](permissions.md).

A company rollout still needs employee sign-in/provisioning, revocation, dedicated Wiki permissions enforced by all human and AI access paths, backups with restore checks, and an audit trail identifying the editor. Hosting location and retention need to be selected for Optimize. Installing the Mac app does not provision a team server or employees. Per-page restrictions remain future work.

## Engineering and compatibility

Settings → Engineering groups company/project prompts, context sources and tools, agent profiles and skills, models, and extensions. Existing agent/model/plugin deep links lead to the corresponding tab. Context configuration uses the prompts and source/tool switches; a separate retrieval-ranking or token-budget engine is not included.

The document Wiki is gated once by `server_info.features.optimizeWikiLifecycle`. Older hosts need an update. Earlier Wiki flags stay available for older clients; the graph UI has been removed. New RPCs are additive `wiki.trash` and `wiki.archive` request/response pairs alongside history, revision, index, search, read, and write. Optional tombstone and alias metadata preserve old message parsing. Optional parent metadata preserves existing articles and old-client writes. The boolean success payloads use ordinary unions because the current generated validator emits incorrect string cases for boolean discriminators; regression tests exercise the actual compiled wire validator.
