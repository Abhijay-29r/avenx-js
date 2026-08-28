---
title: Deferred Loading (<@defer>)
description: Deklaratives Verzögern von Komponenten und DOM-Subbäumen bis ein definierter Trigger ausgelöst wird.
---

Das `<@defer>`-Compiler-Tag ermöglicht das **deklarative Verzögern** von Komponenten und DOM-Subbäumen in Avenx.js. Der Inhalt wird nicht sofort gerendert, sondern erst dann geladen, wenn der konfigurierte Trigger ausgelöst wird.

Dies kann dazu beitragen, die anfängliche Rendering- und JavaScript-Arbeitslast zu reduzieren, indem nicht benötigte Inhalte erst bei Bedarf verarbeitet werden.

---

## Basis-Syntax

Um einen Template-Bereich zu verzögern, umhülle ihn einfach mit dem `<@defer>`-Tag:

```html
<@defer>
  <HeavyChart data="{{ state.chartData }}" />
</@defer>
```

Wenn kein `when`-Attribut angegeben wird, verwendet `<@defer>` standardmäßig den `idle`-Trigger. Dabei wird `requestIdleCallback` verwendet, sofern diese Browser-API verfügbar ist. Andernfalls wird auf einen kurzen Timer zurückgegriffen.

---

## Trigger-Modi (`when="..."`)

Über das `when`-Attribut lässt sich festlegen, wann der verzögerte Inhalt geladen werden soll:

| Trigger               | Syntax                              | Beschreibung                                                                                          |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **`idle`** (Standard) | `<@defer when="idle">`              | Lädt den Inhalt während der Browser-Leerlaufzeit.                                                     |
| **`visible`**         | `<@defer when="visible">`           | Lädt den Inhalt, sobald der Defer-Container im Viewport sichtbar wird.                                |
| **`interaction`**     | `<@defer when="interaction">`       | Lädt den Inhalt bei einer Benutzerinteraktion. Aktuell lösen `click` oder `mouseenter` das Laden aus. |
| **`timer(ms)`**       | `<@defer when="timer(1000)">`       | Lädt den Inhalt nach der angegebenen Verzögerung in Millisekunden.                                    |
| **Ausdruck**          | `<@defer when="state.showDetails">` | Wertet den angegebenen Ausdruck aus und lädt den Inhalt, wenn das Ergebnis wahr ist.                  |

---

### `idle`

Der `idle`-Trigger lädt den verzögerten Inhalt, sobald der Browser Leerlaufzeit zur Verfügung hat.

```html
<@defer when="idle">
  <HeavyChart />
</@defer>
```

Avenx.js verwendet dafür `requestIdleCallback`, sofern diese Browser-API verfügbar ist. Andernfalls wird ein kurzer Timer als Fallback verwendet.

### `visible`

Der `visible`-Trigger lädt den Inhalt, sobald der Defer-Container im Viewport sichtbar wird.

```html
<@defer when="visible">
  <HeavyChart />
</@defer>
```

Avenx.js verwendet dafür `IntersectionObserver`. Sobald der Container sichtbar wird, wird der Observer beendet und der verzögerte Inhalt geladen.

### `interaction`

Der `interaction`-Trigger lädt den Inhalt, sobald der Benutzer mit dem Defer-Container interagiert.

Aktuell lösen sowohl `click` als auch `mouseenter` das Laden des Inhalts aus. Die Trigger-Werte `click` und `hover` werden ebenfalls als Interaktions-Trigger unterstützt.
```html
<@defer when="click">
  <HeavyChart />
</@defer>

<@defer when="hover">
  <HeavyChart />
</@defer>
```

### `timer`

Der `timer`-Trigger lädt den verzögerten Inhalt nach Ablauf einer angegebenen Verzögerung in Millisekunden.

```html
<@defer when="timer(2000)">
  <BannerAd />
</@defer>
```

In diesem Beispiel wird der Inhalt nach 2000 Millisekunden (2 Sekunden) geladen. Avenx.js unterstützt auch Zeitangaben im Format `1000ms`.

### `Ausdruck`

Ein Ausdruck kann als Trigger verwendet werden, um den verzögerten Inhalt abhängig vom aktuellen Zustand zu laden.

```html
<@defer when="state.isReady">
  <HeavyComponent />
</@defer>
```

Der Ausdruck wird ausgewertet, wenn der Defer-Container verarbeitet wird. Wenn das Ergebnis wahr ist, wird der verzögerte Inhalt geladen. Wird der Container später erneut verarbeitet, wird der Ausdruck erneut ausgewertet.



## Platzhalter & Ladezustände (`<@placeholder>` & `<@loading>`)

Innerhalb von `<@defer>` können optionale Sub-Tags verwendet werden.

### `<@placeholder>`

`<@placeholder>` definiert den Inhalt, der angezeigt wird, während auf den konfigurierten Trigger gewartet wird.

```html
<@defer when="visible">
  <@placeholder>
    <div class="skeleton-loader">
      Diagramm wird geladen, sobald es sichtbar ist...
    </div>
  </@placeholder>

  <HeavyChart data="{{ state.chartData }}" />
</@defer>
```

### `<@loading>`

`<@loading>` wird vom Compiler erkannt und als separates Lade-Template vorbereitet.

```html
<@defer when="visible">
  <@loading>
    <div class="spinner">Profil wird geladen...</div>
  </@loading>

  <UserProfileDetails user="{{ state.user }}" />
</@defer>
```

**Aktueller Status:** In der aktuellen synchronen Laufzeit wird das `<@loading>`-Template noch nicht angezeigt. Sobald der Trigger ausgelöst wird, wird der verzögerte Inhalt direkt gerendert. Eine aktive Anzeige des Ladezustands kann mit zukünftiger asynchroner Ladeunterstützung ergänzt werden.

---

## Mehrere Trigger

Das Kombinieren mehrerer Trigger wird derzeit noch nicht unterstützt.

Beispielsweise kann folgende Syntax aktuell nicht verwendet werden:

```html
<@defer when="visible; interaction">
  <HeavyComponent />
</@defer>
```

Aktuell kann für einen `<@defer>`-Block nur ein Trigger angegeben werden. Die Unterstützung für mehrere kombinierte Trigger ist für eine zukünftige Erweiterung vorgesehen.

## Cleanup und Lebenszyklus

Avenx.js registriert für aktive Trigger entsprechende Cleanup-Funktionen.

Je nach verwendetem Trigger werden beispielsweise:

- Event-Listener für `click` und `mouseenter` entfernt.
- Timer mit `clearTimeout()` abgebrochen.
- Idle-Callbacks mit `cancelIdleCallback()` abgebrochen, sofern verfügbar.
- `IntersectionObserver`-Instanzen mit `disconnect()` beendet.

Wenn der Trigger ausgelöst wird und der verzögerte Inhalt geladen wird, wird die zugehörige Trigger-Cleanup-Funktion ausgeführt.

> **Hinweis:** Die vollständige Bereinigung beim Unmount eines übergeordneten Components ist derzeit noch nicht garantiert. Die `DeferManager.destroy()`-Methode ist momentan noch ein Platzhalter und wird beim Component-Teardown noch nicht aufgerufen. Eine vollständige Unmount-Bereinigung ist für eine zukünftige Erweiterung vorgesehen.


---

## Technische Funktionsweise

Die Verarbeitung von `<@defer>` erfolgt in zwei wesentlichen Schritten:

1. **Kompilier-Schritt:** Der `ComponentParser` erkennt `<@defer>` und wandelt es in einen speziellen Defer-Container um. Abhängig vom verwendeten Inhalt können darin Templates für `<@placeholder>`, `<@loading>` und den eigentlichen verzögerten Inhalt gespeichert werden.

2. **Laufzeit-Schritt:** Der `DeferManager` verarbeitet die Defer-Container und richtet den konfigurierten Trigger ein. Je nach Trigger verwendet er beispielsweise `requestIdleCallback`, `IntersectionObserver`, Event-Listener oder `setTimeout`.

Sobald der Trigger ausgelöst wird, rendert der `DeferManager` den verzögerten Inhalt und entfernt zuvor gerenderten Placeholder-Inhalt.
