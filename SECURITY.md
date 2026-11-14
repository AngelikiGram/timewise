# Security

Phase 1 has no accounts, backend, user data or secrets, so its attack surface is small. No formal security review has been done.

In place:

- Map popups build DOM with `textContent`, and React escapes all other data, so data content can't inject markup.
- External links use `rel="noopener noreferrer"`.
- `.env` files are ignored by git.
- The collection is schema-validated on load, and the app refuses to start on an integrity failure.

One inline script sets the theme before first paint. A Content Security Policy needs to allow for it when one is added.

Spec section 15 (prompt injection, SSRF, authorization, abuse limits) applies from Phases 2 to 8 and is not yet implemented.
