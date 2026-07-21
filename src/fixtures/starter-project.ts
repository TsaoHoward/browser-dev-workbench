import type { WorkspaceFile } from '../lib/workspace';

export const starterProject: WorkspaceFile[] = [
  {
    path: 'package.json',
    contents: JSON.stringify(
      {
        name: 'browser-workspace-demo',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          check: 'svelte-check --tsconfig ./tsconfig.json',
        },
        dependencies: {
          '@sveltejs/vite-plugin-svelte': '^6.2.4',
          '@tsconfig/svelte': '^5.0.8',
          svelte: '^5.56.7',
          'svelte-check': '^4.7.3',
          typescript: '^6.0.3',
          vite: '^7.3.6',
        },
      },
      null,
      2,
    ),
  },
  {
    path: 'index.html',
    contents: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebContainer Svelte demo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.ts',
    contents: `import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';

mount(App, { target: document.getElementById('app')! });
`,
  },
  {
    path: 'src/App.svelte',
    contents: `<script lang="ts">
  let count = 0;
</script>

<main>
  <p class="eyebrow">RUNNING INSIDE YOUR BROWSER</p>
  <h1>Hello from Svelte + WebContainers</h1>
  <p>Edit this file in the workbench, restart the dev server, and see the result here.</p>
  <button onclick={() => count += 1}>Clicked {count} {count === 1 ? 'time' : 'times'}</button>
</main>
`,
  },
  {
    path: 'src/style.css',
    contents: `:root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: #e8eef9;
  background: #111827;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  display: grid;
  place-items: center;
}

main {
  max-width: 42rem;
  padding: 4rem 2rem;
  text-align: center;
}

.eyebrow {
  color: #5eead4;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

h1 {
  margin: 0.5rem 0 1rem;
  font-size: clamp(2.25rem, 7vw, 4.5rem);
  line-height: 0.98;
}

p {
  color: #a7b4c8;
  line-height: 1.6;
}

button {
  margin-top: 1rem;
  padding: 0.8rem 1.1rem;
  border: 1px solid #5eead4;
  border-radius: 0.65rem;
  color: #071a18;
  background: #5eead4;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
`,
  },
  {
    path: 'tsconfig.json',
    contents: JSON.stringify(
      {
        extends: '@tsconfig/svelte/tsconfig.json',
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noEmit: true,
        },
        include: ['src/**/*.ts', 'src/**/*.svelte'],
      },
      null,
      2,
    ),
  },
  {
    path: 'vite.config.ts',
    contents: `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({ plugins: [svelte()] });
`,
  },
  {
    path: 'svelte.config.js',
    contents: `export default {};
`,
  },
];
