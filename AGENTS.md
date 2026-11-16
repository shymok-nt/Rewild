# Rewild AI development rules

- Stack: Babylon.js ES modules, TypeScript strict mode, Vite.
- Keep rendering and world generation separate from entrypoint.
- Avoid placeholder features that pretend to work. Clearly label prototype-only behavior.
- No new dependency without explaining its purpose.
- Do not replace existing working systems when adding new features.
- Run `npm run build` before declaring a change tested.
- Prefer simple, performant geometry and deterministic placement for initial scenes.
- Keep game logic in `src/`; do not commit generated `dist/` or `node_modules/`.
