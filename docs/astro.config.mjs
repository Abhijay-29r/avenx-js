// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.avenx-js.com',
	base: '/',
	redirects: {
		'/': '/getting-started/intro',
	},
	integrations: [
		starlight({
			title: 'Avenx-JS',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/avenx-js/avenx-js' }
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/intro' },
						{ label: 'Installation', slug: 'getting-started/install' },
						{ label: 'Quick Start Tutorial', slug: 'getting-started/quickstart' },
						{ label: 'Project Structure', slug: 'getting-started/structure' },
						{ label: 'Configuration', slug: 'getting-started/configuration' },
						{ label: 'TypeScript & JSDoc', slug: 'getting-started/typescript' },
					],
				},

				{
					label: 'Core Concepts',
					items: [
						{ label: 'Template Expressions & Data Binding', slug: 'core-concepts/template-expressions' },
						{ label: 'Component Structure', slug: 'core-concepts/components' },
						{ label: 'Reactive State', slug: 'core-concepts/reactivity' },
						{ label: 'Computed Properties', slug: 'core-concepts/computed' },
						{ label: 'Actions & Event Handling', slug: 'core-concepts/events' },
						{ label: 'Templates & Slots', slug: 'core-concepts/templates' },
						{ label: 'Transition Animations', slug: 'core-concepts/transitions' },
						{ label: 'Scoped & Global CSS', slug: 'core-concepts/styling' },
						{ label: 'Shared State & Bridges', slug: 'core-concepts/bridges' },
						{ label: 'Provide & Inject', slug: 'core-concepts/provide-inject' },
						{ label: 'Custom Directives', slug: 'core-concepts/directives' },
						{ label: 'Form Validation & $validation', slug: 'core-concepts/form-validation' },
						{ label: 'Resources & Async Data', slug: 'core-concepts/resources' },
						{ label: 'Pages & Routing', slug: 'core-concepts/routing' },
					],
				},


				{
					label: 'CLI Reference',
					items: [
						{ label: 'CLI Commands', slug: 'cli-reference/commands' },
						{ label: 'Vite Plugin (vite-plugin-avenx)', slug: 'cli-reference/vite-plugin' },
					],
				},
				{
					label: 'Migration Guides',
					items: [
						{ label: 'Overview & Architectural Comparison', slug: 'migration/overview' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'VirtualList Performance Guide', slug: 'guides/virtual-list' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'AvenxApp API', slug: 'api-reference/app' },
						{ label: 'AvenxComponent API', slug: 'api-reference/component' },
						{ label: 'AvenxPage API', slug: 'api-reference/page' },
						{ label: 'AvenxRouter & Guard API', slug: 'api-reference/router-guard' },
						{ label: 'VirtualList API', slug: 'api-reference/virtuallist' },
						{ label: 'Utility Functions', slug: 'api-reference/utils' },
						{ label: 'Testing API', slug: 'api-reference/testing' },
					],
				},
				{
					label: 'Troubleshooting',
					items: [
						{ label: 'Error Codes', slug: 'troubleshooting/errors' },
					],
				},
				{
					label: 'Best Practices',
					items: [
						{ label: 'Best Practices', slug: 'best-practices/guide' },
					],
				},
			],
		}),
	],
});
