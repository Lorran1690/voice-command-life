<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Frontend architecture
- Keep the orbital voice visualization in a shared OrbitalCore component, driven by the live call status; this isolates decorative motion from audio transport.
- Show conversation history and personal organization in collapsible desktop rails and mobile Sheet panels; this preserves a prioritized conversation while keeping workflows accessible.
- Define HUD colors and animation styling in the global semantic token system; this keeps the chat and login visually consistent without hardcoded feature colors.
