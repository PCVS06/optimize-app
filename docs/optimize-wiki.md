# Optimize Wiki

Optimize Wiki is the built-in company knowledge area at the bottom of the sidebar. Staff can create, read, edit, and search Markdown pages. It starts empty: add verified company facts, product references, support guidance, and operating procedures rather than assumed policies.

The Wiki belongs to the connected Optimize host and is available across that host's projects. Multiple devices connected to that host use the same Wiki. Separate hosts have separate Wikis; the host picker chooses which one is open. This version does not provide cloud synchronization or per-page access roles.

## Storage and recovery

Pages are UTF-8 JSON files under the Optimize data directory, normally `~/.optimize/wiki/<page-id>.json`. Each file contains the title, Markdown body, ID, revision, and creation/update timestamps. This directory is runtime company data, outside the source repository. Include it in the host's backup policy; updating the app does not replace it.

Writes are atomic and serialized per host directory. An edit must carry the revision it opened. Conflicting edits return an error and keep the draft in the editor; cancel and reopen the page to compare the latest version. Previous revisions are retained under `wiki/history/<page-id>/` for administrator recovery. There is currently no in-app history browser, deletion, automatic import, or document attachment indexing.

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
