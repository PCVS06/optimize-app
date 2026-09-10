# Optimize assistant context

Configure behavior in **Settings → Engineering → System prompts**. The company prompt applies to every conversation on that host. Project instructions belong to the selected project's settings. Each assistant has its own **System prompt**; its **When to use** description only helps people choose it and is never applied as instructions.

Company rules take priority over project rules, which take priority over assistant rules. Pi retains its built-in base instructions. The host resolves the current company, project and selected assistant before each new turn, including resumed conversations. Saving a prompt does not interrupt a response already running. A conversation stores the assistant's ID, so changing that assistant updates existing chats using it from their next turn. Deleting an assistant removes its instructions from those chats; it does not erase their history.

Project ownership comes from the workspace registry's current project ID. Moving a chat changes the project instructions and project memories used for its next turn; its private execution directory does not determine its project.

## Memory

**Settings → Memory** contains facts and preferences remembered across conversations. Company memories apply to every chat on the host. Project memories apply only to that project. Chats outside projects use company memory. Memory and Wiki contents are evidence, not instruction sources or permission grants.

Ask the assistant to remember a specific fact and name the intended scope, or add it in settings. The assistant must not automatically copy private Microsoft messages, credentials or customer details into shared memory. Chat history is retained separately; retaining a conversation does not copy all its content into company memory.

The host stores memory in `$PASEO_HOME/memory/records.json`. Writes and removals require the revision just read, so a second editor cannot silently overwrite a concurrent change. The UI keeps unpublished edits on the current Mac and offers to restore them. Forgetting a memory removes it from future remembered context; the original chat, source document and any text already included in an earlier message remain.

Each new turn receives at most 12,000 characters of memory records. The assistant can search additional eligible records with `optimize_memory_list`; cross-project memory is excluded both from injection and assistant tools. The store accepts up to 2,000 records, each with at most 6,000 characters of content. These limits are explicit so the assistant does not silently expand every conversation with all company history.

Connected devices share the same host's memory and Wiki. Independent local hosts remain separate. The current connection permissions govern host access; this does not provide employee accounts, per-project privacy roles or central company synchronization.
