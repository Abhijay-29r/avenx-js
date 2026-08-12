---
title: Deferred Loading (<@defer>)
description: Deklaratives Verzögern von schweren Komponenten und DOM-Subbäumen für optimale Core Web Vitals.
---

Das `<@defer>`-Compiler-Tag ermöglicht das **deklarative Verzögern** (Lazy Loading & Deferred Hydration) von schweren Komponenten, Bildern, Diagrammen oder Template-Abschnitten in Avenx.js.

Dadurch werden der initiale JavaScript-Ausführungsaufwand und das DOM-Rendering drastisch reduziert, was zu hervorragenden **Core Web Vitals** (insbesondere LCP, TBT und FID/INP) führt.

---

## Basis-Syntax

Um einen Template-Bereich zu verzögern, umhülle ihn einfach mit dem `<@defer>`-Tag:

```html
<@defer>
  <HeavyChart data="{{ state.chartData }}" />
</@defer>
```

Standardmäßig lädt `<@defer>` den Inhalt während der Leerlaufzeit des Browsers (`requestIdleCallback`).

---

## Trigger-Modi (`when="..."`)

Über das `when`-Attribut lassen sich verschiedene Lade-Auslöser festlegen:

| Trigger | Syntax | Beschreibung |
|---|---|---|
| **`idle`** (Default) | `<@defer when="idle">` | Lädt den Inhalt, sobald der Browser leerläuft (`requestIdleCallback`). |
| **`visible`** | `<@defer when="visible">` | Lädt erst, wenn das Element im Viewport sichtbar wird (`IntersectionObserver`). |
| **`interaction`** | `<@defer when="interaction">` | Lädt beim Klick oder Hover (`click` / `mouseenter`) auf den Platzhalter. |
| **`timer(ms)`** | `<@defer when="timer(1000)">` | Lädt nach Ablauf einer Verzögerung in Millisekunden. |
| **`expression`** | `<@defer when="state.showDetails">` | Lädt, sobald der reaktive State-Ausdruck zu `true` evaluiert. |

### Beispiele

#### 1. Sichtbarkeit im Viewport (`when="visible"`)
```html
<@defer when="visible">
  <HeavyChart data="{{ state.chartData }}" />
  
  <@placeholder>
    <div class="skeleton-loader">Diagramm wird geladen, sobald sichtbar...</div>
  </@placeholder>
</@defer>
```

#### 2. Benutzer-Interaktion (`when="interaction"`)
```html
<@defer when="interaction">
  <RichTextEditor content="{{ state.body }}" />

  <@placeholder>
    <button class="btn">Hier klicken, um Editor zu laden</button>
  </@placeholder>
</@defer>
```

#### 3. Timer-Verzögerung (`when="timer(2000)"`)
```html
<@defer when="timer(2000)">
  <BannerAd />
</@defer>
```

---

## Platzhalter & Ladezustände (`<@placeholder>` & `<@loading>`)

Innerhalb von `<@defer>` können optionale Sub-Tags deklariert werden:

* **`<@placeholder>`**: Der Platzhalter-Inhalt, der sofort gerendert wird, bevor der Trigger auslöst.
* **`<@loading>`**: Zeigt einen optionalen Ladezustand (z. B. Spinner) während des Nachladens an.

```html
<@defer when="visible">
  <!-- Eigentlicher schwerer Inhalt -->
  <UserProfileDetails user="{{ state.user }}" />

  <!-- Platzhalter vor dem Trigger -->
  <@placeholder>
    <div class="user-card-skeleton">Profile Skeleton...</div>
  </@placeholder>

  <!-- Ladezustand beim Nachladen -->
  <@loading>
    <div class="spinner">Profil wird geladen...</div>
  </@loading>
</@defer>
```

---

## Technische Funktionsweise

1. **Kompilier-Schritt ([ComponentParser](file:///Users/nathanschmid/Documents/git_local/avenx-js/lib/compiler/ComponentParser.js))**: Der Compiler übersetzt den `<@defer>`-Tag in ein leichtes DOM-Gerüst mit `<template data-ax-defer-placeholder>` und `<template data-ax-defer-content>`.
2. **Laufzeit-Schritt ([DeferManager](file:///Users/nathanschmid/Documents/git_local/avenx-js/lib/core/renderer/deferManager.js))**: Der `DeferManager` verwaltet die Event-Listener und Observer (`IntersectionObserver`, `requestIdleCallback`, `setTimeout`). Sobald die Bedingung erfüllt ist, wird der Platzhalter durch den echten Inhalt ausgetauscht und reaktiv hydriert.
