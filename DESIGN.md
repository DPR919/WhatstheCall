# What's The Call? design guide

This guide records the **Editorial** direction chosen for the site refresh. Use it when adding pages, components, or copy. The implemented styles remain the source of truth for exact values; update this guide when the direction changes.

## Product idea

**One action. Many calls.** Members watch a fencing action, make their own call, and then compare it with other people's decisions. The experience should invite careful observation and reflection. It does not present the community result as an official ruling or imply that disagreement is a failure.

The core sequence is **Watch → Decide → Compare**. Keep the video and the member's decision prominent. Show the community response after the member has called the action. Admin uploading supports this experience but should not compete with it for attention.

## Principles

1. **Make the action central.** The clip is the main content on member pages. Controls and context should help people study it without crowding the frame.
2. **Feel considered, not clinical.** Use generous space, editorial type, warm paper surfaces, thin rules, and a restrained accent. Avoid dashboard tiles, heavy shadows, and decoration that competes with the action.
3. **Make every cue truthful.** A counter implies a sequence; a control implies an action. Do not add decorative pagination, fake metrics, or status labels that the product cannot explain.
4. **Welcome both referees and enthusiasts.** Use fencing terms where they clarify the task, and explain the next action in plain language. Keep the tone thoughtful rather than authoritative.
5. **Work at every size and input method.** Preserve readable type, visible focus, labeled controls, sensible keyboard order, and layouts that reflow without horizontal page scrolling.

## Visual language

- **Palette:** warm paper `#f5f1e9`, near-white surface `#fffdfa`, dark ink `#29251f`, muted text `#685f54`, fine borders `#d8cec0`, and a deep red accent `#9d402b`. The CSS variables in `app/editorial.css` define the current values.
- **Typography:** Georgia for expressive display and section headings; a simple sans serif for body copy, controls, and metadata. Use italic display text for emphasis, not as a default on every heading.
- **Hierarchy:** a small uppercase eyebrow may introduce a section, followed by a clear serif heading and concise supporting copy. Reserve large display type for a page's main idea.
- **Surfaces:** flat, opaque panels with fine borders. Use spacing and rules to organize collections. Keep the accent for primary actions, active navigation, key labels, and results marks.
- **Imagery:** use real fencing imagery where it adds context. Avoid generic sports graphics and overlays that obscure the action.

## Page patterns

- **Public landing:** an editorial split hero, one clear invitation to join, a brief explanation of Watch / Decide / Compare, and project context.
- **Account pages:** a consistent split layout that keeps the form simple and explains why someone is joining or signing in.
- **Member pages:** persistent navigation, a page introduction, and one dominant task or collection. On small screens, navigation reflows into a visible grid.
- **Clip study:** a clear starting state, large player, equally legible Left / No touch / Right choices, and community results shown after submission. The upload panel follows the calling flow for admins.
- **Collections:** date or context labels, quiet rows, clear actions, and useful empty states. Do not invent clip titles or metadata that the data does not contain.

## Writing and interaction

- The headline **“One action. Many calls.”** expresses the product's premise. Supporting copy should explain the concrete task.
- Prefer direct actions such as “Show me a clip,” “Watch again,” and “View community results.”
- Describe the member's choice as **their call**. Describe aggregate results as **community calls**, not the correct answer.
- Use real feedback for loading, success, error, and empty states. Keep all important information visible without hover.
- Make navigation destinations and permissions clear. Admin-only actions stay in admin areas.

## Where to extend the system

Start with the variables and shared classes in `app/editorial.css`, the account form classes in `app/constants/design-system.ts`, and the reusable shells in `app/components/`. Follow existing public, account, and member page patterns before adding new styles. When a new pattern is genuinely needed, add it to the shared system and update this guide.
