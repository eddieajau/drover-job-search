---
name: custom-elements
description: Engineering standards for Custom HTML Elements. Use when creating, editing, or reviewing any Custom Element (customElements.define, HTMLElement subclass, connectedCallback, etc.).
---

# Custom HTML Elements — Engineering Standard

All UI in this project uses native Custom Elements. No framework. These rules are non-negotiable.

## Element Structure

```typescript
export interface UserProfileEventMap {
  'user-profile:save': CustomEvent<{ id: string; name: string }>
}

type UserProfileAttribute = 'user-id' | 'disabled'

export class UserProfile extends HTMLElement {
  static observedAttributes: UserProfileAttribute[] = ['user-id', 'disabled']

  #userId = ''
  #disabled = false

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.syncDisplay()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  attributeChangedCallback(name: UserProfileAttribute, _oldValue: string | null, newValue: string | null): void {
    if (newValue === null && name === 'disabled') {
      this.#disabled = false
      this.updateDisabledState()
      return
    }
    switch (name) {
      case 'user-id':
        this.#userId = newValue ?? ''
        this.loadUserData()
        break
      case 'disabled':
        this.#disabled = true
        this.updateDisabledState()
        break
    }
  }

  // ... methods
}

customElements.define('user-profile', UserProfile)

declare global {
  interface HTMLElementTagNameMap {
    'user-profile': UserProfile
  }
}
```

## Rules

### 1. One Element, One Job

An element does one thing. A file uploader uploads files. A date picker picks dates. A tab panel switches panels. If an element needs a second paragraph to explain what it does, split it.

### 2. Attributes Are the External API

- Attributes for data in, CustomEvents for data out.
- Private fields (`#field`) hold internal state.
- Keep attributes and private fields in sync via `attributeChangedCallback` and public setters.
- Boolean attributes: presence = true, absence = false.

### 3. Communication Direction

| Direction      | Mechanism                                                                                |
| -------------- | ---------------------------------------------------------------------------------------- |
| Child → Parent | `this.dispatchEvent(new CustomEvent('name', { bubbles: true, composed: true, detail }))` |
| Parent → Child | Direct method calls via `querySelector` typed through `HTMLElementTagNameMap`            |
| Cross-cutting  | `window` events (use sparingly, document why)                                            |

Never import another element's class to call methods on it. Query it from the DOM.
For shared event names, prefer exported constants/enums to avoid typo bugs.

### 4. Event Contracts

- Namespace events: `element-name:action` (e.g. `user-profile:save`).
- Define an `EventMap` interface for every element that dispatches events.
- Type event `detail` — never use untyped `CustomEvent`.

### 5. Lifecycle Discipline

**connectedCallback** — always this order:

1. `this.render()` (DOM must exist before listeners)
2. `this.setupEventListeners()`
3. Sync display with current state

`connectedCallback` can run more than once (detach/reattach, moving nodes). Make setup idempotent: avoid duplicate global listeners/timers.

**disconnectedCallback** — mandatory when ANY of these are true:

- Listeners added to `document`, `window`, or elements outside `this`
- `setInterval`, `setTimeout`, or `requestAnimationFrame` active
- `AbortController` in use

**attributeChangedCallback** fires before `connectedCallback`. Update methods must guard against missing DOM (`querySelector` may return `null`).

### 6. Cleanup

Prefer `AbortController` for listener groups:

```typescript
#abort = new AbortController()

setupEventListeners(): void {
  const opts = { signal: this.#abort.signal }
  window.addEventListener('user:logout', this.#onLogout, opts)
  this.querySelector('.submit-btn')?.addEventListener('click', this.#onSubmit, opts)
}

cleanup(): void {
  this.#abort.abort()
}
```

### 7. Rendering

- **Favour `innerHTML` style**: Explicitly favour creating elements with template literal `innerHTML` (e.g. `this.innerHTML = \`...\`` inside `render()`) as illustrated in `apps/portal/src/ui/elements/app-shell.ts`. Declarative `innerHTML` templates are significantly more human readable and maintainable than imperative DOM creation (`document.createElement`, `appendChild`, etc.). Use `innerHTML` template literals by default unless the structural complexity of the element demands programmatic DOM construction (e.g. `<canvas>` contexts, node-level child preservation, or advanced dynamic updates).
- Canvas-based elements render to a `<canvas>` context, not innerHTML. They still follow all other rules (lifecycle, cleanup, events, mediator pattern).
- For containers that accept children, save `childNodes` before clearing, then re-append.
- After re-render, re-attach internal listeners (or use event delegation on `this`).
- Never insert unsanitised user input into `innerHTML`.

### 8. No Shadow DOM (Default)

Use Light DOM unless you have a specific, documented reason for style isolation.

### 9. No Inheritance Between Elements

Elements extend `HTMLElement` only. Never extend another custom element. Use composition: put child elements inside parent elements.

### 10. No Global State

Never read from or write to `window` for application state. Dependencies come in via:

- Attributes/properties (preferred)
- Method calls from a mediator
- A typed registry/context if needed

### 11. Typing

- Augment `HTMLElementTagNameMap` for every element — no exceptions.
- Define attribute union types: `type XAttribute = 'foo' | 'bar'`.
- Define `EventMap` interfaces for dispatched events.
- Zero tolerance for `as any` on queried elements. If the type is missing, add the `HTMLElementTagNameMap` entry.

### 12. File Convention

One element per file. File named after the tag: `user-profile.ts` defines `<user-profile>`. Registration (`customElements.define`) and `HTMLElementTagNameMap` augmentation at the bottom of the same file.

Directory convention (see `apps/portal/src/ui/`):

- `ui/elements/` — genuinely shared elements only (e.g. `app-shell`, and future shared controls like pagination).
- `ui/pages/<page>/` — page-scoped elements for a single page, container in `index.ts` with its peers beside it (e.g. `ui/pages/search/index.ts` composes `search-form` + `search-results`).

A page-scoped element may move into `ui/elements/` only when it becomes genuinely shared across pages.

## Mediator Pattern

Elements do not know about the data layer, server, or business logic. Mediator modules in `ui/src/lib/` bridge the gap:

1. Mediator imports element types only for `HTMLElementTagNameMap` typing
2. Mediator listens for element events on `document` or `window`
3. Mediator calls the backend (API, state engine, etc.), then pushes results into elements via methods or attributes
4. Elements never call the backend directly, never `fetch()`, never touch `localStorage`

```
Element ──(CustomEvent)──▶ Mediator ──(method call)──▶ Element
                              │
                      ┌───────┴───────┐
                      ▼               ▼
                 Backend API     Persistence
```

### Backend Integration

Mediators own the backend communication. The pattern:

1. Element dispatches a CustomEvent (e.g. `user-profile:save`)
2. Mediator receives the event, calls the backend (e.g. `api.saveUser(data)`)
3. Mediator reads the response
4. Mediator pushes results into elements via method calls or attributes
5. Mediator broadcasts a namespaced update event on `window` for any element that needs reactive updates

Elements never import or reference the backend module directly. The backend is the mediator's dependency, not the element's.
