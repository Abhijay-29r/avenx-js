import { AvenxApp } from 'avenx-core/runtime';
import StatCard from './components/stat-card/stat-card.component.js';
import CardBadge from './components/card-badge/card-badge.component.js';

const app = new AvenxApp({ target: '#app' });

app.register('StatCard', StatCard);
app.register('CardBadge', CardBadge);

app.initRouter({
  '': 'Composition',
  '#/': 'Composition',
});
