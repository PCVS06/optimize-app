# Optimize company integrations

The Mac app ships Pi, its Optimize extension, three company skills, and the native Optimize Automation helper. Updates come from this repository. Engineering → Integrations explains the entry points; commands and connection prompts run inside the conversation. The helper needs no Swift installation on the receiving Mac.

## Wiki and connected tools

The `optimize-wiki` skill owns article structure and publication rules. See [Wiki](optimize-wiki.md) for storage, history and team access. Enable host tools in Engineering → Context to expose the authenticated host connection to Pi. The bundled bridge makes stock Pi recognize the runtime MCP configuration. It exposes Wiki and browser tools from Optimize's host, and tools from explicitly configured external HTTP/stdio MCP servers. It does not expose the host's coding-agent administration catalog. A failed connection is reported in the conversation.

## Microsoft 365 setup

Register an application owned by Optimize in Microsoft Entra → App registrations. Use the company tenant and enable **Allow public client flows** under Authentication for device-code sign-in. Do not embed a client secret in the Mac app. Copy the Application (client) ID and Directory (tenant) ID. Microsoft documents this flow at [device authorization grant](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).

In a conversation, enter `/microsoft` or ask to connect Microsoft 365. Enter the application and tenant IDs. Open the displayed Microsoft verification URL yourself, enter the displayed code, and sign in. Run `/microsoft finish` after consenting. Your tenant's administrator may need to approve delegated permissions or may prohibit device-code authentication entirely. That is an explicit setup dependency; an installed connector is not a connected account.

The first interactive command requests Outlook/contact, calendar, files/SharePoint, Teams, OneNote and task scopes. An agent-assisted setup can select only the needed services. The authoritative scope list is `packages/desktop/pi-runtime/extensions/microsoft-api.mjs`; review it with the Microsoft administrator against the [Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference). All access is delegated as the signed-in user, never app-only tenant access. Service availability also depends on licenses and tenant policy.

Use `/microsoft status` to inspect connection state and granted scopes. Tokens and pending sign-in secrets stay in a `bike.optimize.microsoft365` generic-password entry in the macOS Keychain. They are never returned as tool results. Each Mac OS account connects independently. `/microsoft disconnect` deletes that local entry; revoke application consent in Microsoft for tenant-side revocation. Stable Developer ID signing is needed for production updates to preserve the helper's Keychain trust identity; ad-hoc review builds can trigger new macOS access prompts.

The request tool supports Graph v1.0 operations for mail, contacts, calendar, files, SharePoint, Teams, notes, tasks and Excel workbooks. JSON and HTML bodies are supported, and files up to 25 MB can be downloaded or uploaded. Word and PowerPoint content is edited using their Mac apps through computer use, then uploaded. This is not a Word/PowerPoint semantic editing API. The connector shows each mutation for confirmation, uses optional eTags for supported conditional changes, and never automatically retries writes. Microsoft 403 responses remain failures until access is granted. Reads should use small selected fields and pagination; responses beyond the tool limit require a narrower request.

## Mac computer use

Ask the assistant to operate an app or enter `/computer`. Session consent enables the tool for that conversation. macOS separately requires **Accessibility** and **Screen Recording** for **Optimize Automation** in Privacy & Security. Enter `/computer off` or ask the assistant to stop to revoke that conversation's access. Permissions are not granted automatically.

Observation returns a bounded screenshot of the main display and accessible foreground-app text. Click coordinates are logical display points; image dimensions and display dimensions are returned for scaling. Actions verify the foreground app against the last observation and return a new screenshot. Open, click/double-click/right-click, Unicode text, keyboard shortcuts and vertical scroll are implemented. Dragging and secondary displays are not implemented. Credentials and consent screens remain user-operated.

The computer tool runs on the Mac hosting the agent process. Connecting another viewing device does not transfer control to that viewing device. Linux team hosts do not gain Mac control from this bundle. Separate explicitly enabled conversations are separate sessions; stopping one does not stop another.

## Validation and rollout boundaries

Connector tests use isolated Microsoft responses for sign-in polling, renewal, token isolation, endpoint restrictions, conflicts and rate limits. The MCP test crosses a real authenticated HTTP connection and forwards a Wiki publication request. Packaged verification boots real Pi, checks the bundled commands and skills, and executes the helper's permission-status operation without granting access. Live Microsoft operations require a company registration and account sign-in. Native click/type verification requires the user's macOS grants and an appropriate test document.
