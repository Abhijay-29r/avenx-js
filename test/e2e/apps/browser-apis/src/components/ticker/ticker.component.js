<state ticks="0" width="0" framed="false" stamp="" summary="" />

<action name="onMount">
  this._timerId = setInterval(() => {
    this.state.ticks++;
  }, 20);

  this.handleResize = () => {
    this.state.width = window.innerWidth;
  };
  window.addEventListener('resize', this.handleResize);
  this.handleResize();

  requestAnimationFrame(() => {
    this.state.framed = true;
  });

  const started = new Date(0);
  const epoch = started.getTime();
  this.state.stamp = started.toISOString();
  this.state.summary = JSON.stringify({ epoch });
</action>

<action name="stop">
  clearInterval(this._timerId);
  window.removeEventListener('resize', this.handleResize);
  window.__tickerStopped = true;
</action>

<div data-testid="ticker">
  <output data-testid="ticks">{{ ticks }}</output>
  <output data-testid="width">{{ width }}</output>
  <output data-testid="framed">{{ framed }}</output>
  <output data-testid="stamp">{{ stamp }}</output>
  <output data-testid="summary">{{ summary }}</output>
  <button data-testid="stop" @click="stop()">stop</button>
</div>
