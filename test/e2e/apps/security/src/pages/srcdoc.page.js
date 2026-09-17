<state
  untrusted="'<img src=x onerror=&quot;window.__srcdocXss = true&quot;>'"
  trusted="null"
/>

<action name="onMount">
  window.__srcdocXss = false;
  this.state.trusted = window.avenxHtml('<b data-testid="trusted-body">trusted</b>');
</action>

<main>
  <h1 data-testid="security-heading">Security fixture</h1>
  <iframe data-testid="untrusted-frame" srcdoc="{{ untrusted }}"></iframe>
  <iframe data-testid="trusted-frame" srcdoc="{{ trusted }}"></iframe>
</main>
