---
name: API schema compatibility
description: Compatibility constraint for generated Zod schemas in this workspace
---

Generated Zod schemas currently target the installed Zod 3 runtime, which does not expose `z.int()`. Use numeric OpenAPI fields for IDs and counts instead of `integer` fields when adding endpoints.

**Why:** OpenAPI code generation produced `z.int()` for integer fields and broke the shared library typecheck.

**How to apply:** When extending the API contract, prefer `type: number` for identifiers, counts, and other whole-number values unless the generator/runtime versions are upgraded together.