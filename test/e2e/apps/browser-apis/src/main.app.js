import { AvenxApp } from 'avenx-core/runtime';
import UserList from './components/user-list/user-list.component.js';
import Ticker from './components/ticker/ticker.component.js';

const app = new AvenxApp({ target: '#app' });

// Both components use browser APIs from <resource> and <action> bodies, the
// way README.md, resources.md and lifecycle-hooks.md document them.
app.register('UserList', UserList);
app.register('Ticker', Ticker);

app.initRouter({
  '': 'Shell',
});
