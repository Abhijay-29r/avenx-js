<!--
  A dynamic attribute name whose value is attacker-controlled.

  `onclick="{{ handler }}"` written literally is refused at build time as
  AVX_C28. `:[name]="value"` cannot be: the name is only known at run time, so
  the refusal has to happen in the renderer -- and this construct reaches the
  string renderer specifically, because a dynamic attribute name is itself a
  reason the template cannot be compiled (AVX_W47).

  The risk is only observable in a real browser served without a
  Content-Security-Policy, which is how most applications are deployed: the
  attribute was written into the markup and parsed as a live inline handler,
  so the next click ran it. A strict CSP stopped the execution but not the
  attribute, and no unit test sees either.
-->
<state
  handlerName="'onclick'"
  handlerBody="'window.__dynAttrXss = true'"
  safeName="'data-tone'"
  safeValue="'warm'"
/>

<action name="onMount"> window.__dynAttrXss = false; </action>

<main>
  <h1 data-testid="dynamic-attr-heading">Dynamic attribute names</h1>

  <button data-testid="handler-target" :[handlerName]="handlerBody">click me</button>
  <span data-testid="safe-target" :[safeName]="safeValue">safe</span>
</main>
