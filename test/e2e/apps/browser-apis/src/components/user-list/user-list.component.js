<resource name="users">
  return fetch('users.json').then(res => res.json());
</resource>

<div data-testid="users">
  <@suspense>
    <@fallback><em data-testid="users-loading">Loading users...</em></@fallback>
    <ul>
      <@for user in users>
        <li data-testid="user">{{ user.username }}</li>
      </@for>
    </ul>
  </@suspense>
</div>
