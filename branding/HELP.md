# Using Optimize

Optimize helps with company knowledge, customer replies, documents and daily work.

## Start with a chat

Choose **New chat** and write what you need. A chat does not need a project or a folder. Attach documents or images with the attachment button. The Optimize emblem animates while the assistant works.

If your administrator has configured several assistants, choose the one suited to your work by name. Model and tool setup lives in Engineering.

## Organize a project

Choose **+** beside **Projects**, enter a name and create it. Use **New chat** inside that project to keep related conversations together. The chat options menu lets you rename, pin, archive or **Move to project**. Choose **Outside projects** to return a conversation to the main Chats list.

Project settings contain **Project instructions**: the purpose, preferred sources and how the assistant should work for that project. No folder selection is needed for company projects. Existing folder-based projects remain available.

## Keep company knowledge in the Wiki

The book icon beside Help and Settings opens **Optimize Wiki**. Create an article, give it a title and write directly in the editor. Use the formatting bar or type `/` to insert headings, lists and other blocks. **Link article** connects related pages. A parent page groups articles into a knowledge area; headings build the article's contents list.

Drafts remain on your Mac until you publish them. Find unfinished work under **Your drafts**. Published articles can be searched and read by the assistant. The assistant's Wiki skill guides article structure, sources and publication; a draft requested in chat is not automatically published.

Article history lets you inspect older versions and restore one as a new draft. **Trash** keeps deleted articles and their history until you restore them. Deleted articles are excluded from the assistant's current knowledge. If another person changes an article while you edit, review their latest version before publishing.

## Manage memory

Open **Settings → Memory** to add, search, edit or forget saved facts and preferences. Choose **Company — all chats** for information that should apply everywhere, or choose a project for context limited to that project. You can also explicitly ask the assistant to remember something and name the scope.

Company memory is shared context on the connected Optimize host, not a private notebook. Chat history remains separate. The assistant does not automatically copy private mail or conversations into company memory. Changes are read from the next message.

## Technical setup

The person responsible for setup uses **Settings → Engineering**. This is where company system prompts, assistant profiles and their individual system prompts, context settings, model access, extensions and integrations are configured. Project instructions and assistant prompts add to the company instructions. Prompt changes apply from the next message without interrupting the current answer.

Microsoft 365 requires your company's own Microsoft Entra registration and each employee's sign-in. Computer use requires macOS permissions and consent for the conversation. [Integration setup](../docs/optimize-integrations.md) describes the connection steps and current limits.

## Sharing and updates

People connected to the same Optimize host use its published Wiki and shared memory. Separate local installations do not automatically synchronize their data. A shared company host, employee sign-in and access roles need a separate rollout setup.

**About** shows the version and licenses. Help opens support in your Optimize repository. Updates come from [PCVS06/optimize-app](https://github.com/PCVS06/optimize-app/releases). The current Mac package is an internal review build; production signing and notarization are still required for distribution.
