import type { FileSystemTree } from '@webcontainer/api';
import type { WorkspaceFile } from '../../lib/workspace';
import { buildFileSystemTree } from './file-system-tree';

export type LogSink = (message: string) => void;

export type RuntimeOperationCode =
  | 'boot-failed'
  | 'cancelled'
  | 'command-failed'
  | 'mount-failed'
  | 'runtime-unavailable'
  | 'server-exited-before-ready'
  | 'server-start-timeout';

export class RuntimeOperationError extends Error {
  constructor(
    readonly code: RuntimeOperationCode,
    message: string,
  ) {
    super(message);
    this.name = 'RuntimeOperationError';
  }
}

export interface RuntimeProcess {
  exit: Promise<number>;
  kill(): Promise<void> | void;
  output: ReadableStream<string>;
}

export interface RuntimeContainer {
  fs: {
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
  };
  mount(tree: FileSystemTree): Promise<void>;
  on(event: 'server-ready', listener: (port: number, url: string) => void): () => void;
  spawn(command: string, args: string[]): Promise<RuntimeProcess>;
}

interface RuntimeDependencies {
  boot: () => Promise<RuntimeContainer>;
  crossOriginIsolated: () => boolean;
  isSecureContext: () => boolean;
  sharedArrayBuffer: () => boolean;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
}

export interface StartDevServerOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface PendingDevServerStart {
  cancel: () => void;
  failEarlyExit: (exitCode: number) => void;
  isCancelled: () => boolean;
}

const DEFAULT_SERVER_START_TIMEOUT_MS = 30_000;

const ANSI_ESCAPE_SEQUENCE = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  'g',
);

export function stripAnsi(message: string): string {
  return message.replace(ANSI_ESCAPE_SEQUENCE, '');
}

async function bootWebContainer(): Promise<RuntimeContainer> {
  const { WebContainer } = await import('@webcontainer/api');
  return WebContainer.boot();
}

export class WebContainerRuntime {
  #container: RuntimeContainer | null = null;
  #dependencies: RuntimeDependencies;
  #devProcess: RuntimeProcess | null = null;
  #installedPackageJson = '';
  #mountedPackageJson = '';
  #pendingDevServerStart: PendingDevServerStart | null = null;

  constructor(dependencies: Partial<RuntimeDependencies> = {}) {
    this.#dependencies = {
      boot: bootWebContainer,
      crossOriginIsolated: () => globalThis.crossOriginIsolated,
      isSecureContext: () => globalThis.isSecureContext,
      sharedArrayBuffer: () => typeof SharedArrayBuffer !== 'undefined',
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      ...dependencies,
    };
  }

  async prepare(files: WorkspaceFile[], log: LogSink): Promise<void> {
    await this.stopDevServer();
    const container = await this.#boot(log);
    log('Mounting workspace files...');
    try {
      await container.mount(buildFileSystemTree(files));
    } catch {
      throw new RuntimeOperationError(
        'mount-failed',
        'The workspace could not be mounted in the runtime.',
      );
    }
    this.#mountedPackageJson = files.find((file) => file.path === 'package.json')?.contents ?? '';
    log(`Mounted ${files.length} files.`);
  }

  dependenciesReady(files: WorkspaceFile[]): boolean {
    const packageJson = files.find((file) => file.path === 'package.json')?.contents ?? '';
    return Boolean(this.#container && packageJson && packageJson === this.#installedPackageJson);
  }

  async install(log: LogSink): Promise<void> {
    const container = this.#requireContainer();
    log('$ npm install');
    let process: RuntimeProcess;
    try {
      process = await container.spawn('npm', ['install', '--no-progress', '--color=false']);
    } catch {
      throw new RuntimeOperationError('command-failed', 'npm install could not be started.');
    }
    this.#pipeOutput(process, log);
    const exitCode = await process.exit;

    if (exitCode !== 0) {
      throw new RuntimeOperationError(
        'command-failed',
        `npm install exited with code ${exitCode}.`,
      );
    }

    this.#installedPackageJson = this.#mountedPackageJson;
    log('Dependencies installed.');
  }

  async startDevServer(log: LogSink, options: StartDevServerOptions = {}): Promise<string> {
    const container = this.#requireContainer();
    await this.stopDevServer();

    const timeoutMs = options.timeoutMs ?? DEFAULT_SERVER_START_TIMEOUT_MS;
    if (options.signal?.aborted) {
      throw new RuntimeOperationError('cancelled', 'Dev-server startup was cancelled.');
    }

    let cancelled = false;
    let cancelPendingStart = (): void => undefined;
    let failEarlyExit: (exitCode: number) => void = () => undefined;
    const pendingStart: PendingDevServerStart = {
      cancel: () => cancelPendingStart(),
      failEarlyExit: (exitCode) => failEarlyExit(exitCode),
      isCancelled: () => cancelled,
    };
    this.#pendingDevServerStart = pendingStart;

    const serverReady = new Promise<string>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
      let unsubscribe = (): void => undefined;

      const cleanUp = (): void => {
        unsubscribe();
        if (timeout !== undefined) this.#dependencies.clearTimeout(timeout);
        options.signal?.removeEventListener('abort', onAbort);
      };
      const settle = (result: { url: string } | { error: RuntimeOperationError }): void => {
        if (settled) return;
        settled = true;
        cleanUp();
        if (this.#pendingDevServerStart === pendingStart) {
          this.#pendingDevServerStart = null;
        }
        if ('url' in result) resolve(result.url);
        else reject(result.error);
      };
      const onAbort = (): void => {
        cancelled = true;
        settle({
          error: new RuntimeOperationError('cancelled', 'Dev-server startup was cancelled.'),
        });
      };

      cancelPendingStart = onAbort;
      failEarlyExit = (exitCode): void => {
        settle({
          error: new RuntimeOperationError(
            'server-exited-before-ready',
            `The dev server exited with code ${exitCode} before becoming ready.`,
          ),
        });
      };
      unsubscribe = container.on('server-ready', (_port, url) => settle({ url }));
      timeout = this.#dependencies.setTimeout(() => {
        settle({
          error: new RuntimeOperationError(
            'server-start-timeout',
            `The dev server did not become ready within ${Math.round(timeoutMs / 1000)} seconds.`,
          ),
        });
      }, timeoutMs);
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
    });
    void serverReady.catch(() => undefined);

    log('$ npm run dev -- --host 0.0.0.0 --clearScreen false');
    let process: RuntimeProcess;
    try {
      process = await container.spawn('npm', [
        'run',
        'dev',
        '--',
        '--host',
        '0.0.0.0',
        '--clearScreen',
        'false',
      ]);
    } catch {
      pendingStart.cancel();
      throw new RuntimeOperationError('command-failed', 'npm run dev could not be started.');
    }

    if (pendingStart.isCancelled()) {
      await process.kill();
      throw new RuntimeOperationError('cancelled', 'Dev-server startup was cancelled.');
    }

    this.#devProcess = process;
    this.#pipeOutput(process, log);
    void process.exit.then((exitCode) => {
      if (this.#devProcess === process) {
        this.#devProcess = null;
        log(`Dev server exited with code ${exitCode}.`);
      }
      pendingStart.failEarlyExit(exitCode);
      if (this.#pendingDevServerStart === pendingStart) {
        this.#pendingDevServerStart = null;
      }
    });

    try {
      return await serverReady;
    } catch (error) {
      if (
        error instanceof RuntimeOperationError &&
        (error.code === 'cancelled' || error.code === 'server-start-timeout')
      ) {
        await this.stopDevServer();
      }
      throw error;
    }
  }

  async readTextFile(path: string): Promise<string> {
    return this.#requireContainer().fs.readFile(path, 'utf-8');
  }

  async stopDevServer(): Promise<void> {
    this.#pendingDevServerStart?.cancel();
    this.#pendingDevServerStart = null;
    if (!this.#devProcess) return;
    const process = this.#devProcess;
    this.#devProcess = null;
    await process.kill();
  }

  async #boot(log: LogSink): Promise<RuntimeContainer> {
    if (this.#container) return this.#container;

    if (!this.#dependencies.isSecureContext()) {
      throw new RuntimeOperationError(
        'runtime-unavailable',
        'A secure context is required to start the runtime.',
      );
    }
    if (!this.#dependencies.crossOriginIsolated()) {
      throw new RuntimeOperationError(
        'runtime-unavailable',
        'Cross-origin isolation is unavailable. Reload after the service-worker setup completes.',
      );
    }
    if (!this.#dependencies.sharedArrayBuffer()) {
      throw new RuntimeOperationError(
        'runtime-unavailable',
        'SharedArrayBuffer is unavailable in this browser context.',
      );
    }

    log('Booting WebContainer...');
    try {
      this.#container = await this.#dependencies.boot();
    } catch {
      throw new RuntimeOperationError(
        'boot-failed',
        'The WebContainer runtime could not boot. Retry when the page is ready.',
      );
    }
    log('WebContainer ready.');
    return this.#container;
  }

  #requireContainer(): RuntimeContainer {
    if (!this.#container) {
      throw new RuntimeOperationError(
        'runtime-unavailable',
        'Prepare the workspace before running a command.',
      );
    }
    return this.#container;
  }

  #pipeOutput(process: RuntimeProcess, log: LogSink): void {
    void process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          log(stripAnsi(chunk));
        },
      }),
    );
  }
}
