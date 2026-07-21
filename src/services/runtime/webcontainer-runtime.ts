import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { WorkspaceFile } from '../../lib/workspace';
import { buildFileSystemTree } from './file-system-tree';

export type LogSink = (message: string) => void;

const ANSI_ESCAPE_SEQUENCE = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  'g',
);

export function stripAnsi(message: string): string {
  return message.replace(ANSI_ESCAPE_SEQUENCE, '');
}

export class WebContainerRuntime {
  #container: WebContainer | null = null;
  #devProcess: WebContainerProcess | null = null;
  #mountedPackageJson = '';
  #installedPackageJson = '';

  async prepare(files: WorkspaceFile[], log: LogSink): Promise<void> {
    await this.stopDevServer();
    const container = await this.#boot(log);
    log('Mounting workspace files...');
    await container.mount(buildFileSystemTree(files));
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
    const process = await container.spawn('npm', ['install', '--no-progress', '--color=false']);
    this.#pipeOutput(process, log);
    const exitCode = await process.exit;

    if (exitCode !== 0) {
      throw new Error(`npm install exited with code ${exitCode}.`);
    }

    this.#installedPackageJson = this.#mountedPackageJson;
    log('Dependencies installed.');
  }

  async startDevServer(log: LogSink): Promise<string> {
    const container = this.#requireContainer();

    await this.stopDevServer();

    const serverReady = new Promise<string>((resolve) => {
      const unsubscribe = container.on('server-ready', (_port, url) => {
        unsubscribe();
        resolve(url);
      });
    });

    log('$ npm run dev -- --host 0.0.0.0 --clearScreen false');
    this.#devProcess = await container.spawn('npm', [
      'run',
      'dev',
      '--',
      '--host',
      '0.0.0.0',
      '--clearScreen',
      'false',
    ]);
    const process = this.#devProcess;
    this.#pipeOutput(process, log);
    void process.exit.then((exitCode) => {
      if (this.#devProcess !== process) return;
      log(`Dev server exited with code ${exitCode}.`);
      this.#devProcess = null;
    });

    return serverReady;
  }

  async readTextFile(path: string): Promise<string> {
    return this.#requireContainer().fs.readFile(path, 'utf-8');
  }

  async stopDevServer(): Promise<void> {
    if (!this.#devProcess) return;
    const process = this.#devProcess;
    this.#devProcess = null;
    await process.kill();
  }

  async #boot(log: LogSink): Promise<WebContainer> {
    if (this.#container) {
      return this.#container;
    }

    if (!globalThis.crossOriginIsolated) {
      throw new Error(
        'This page is not cross-origin isolated. Wait for the service-worker reload or check the deployment headers.',
      );
    }

    log('Booting WebContainer...');
    const { WebContainer } = await import('@webcontainer/api');
    this.#container = await WebContainer.boot();
    log('WebContainer ready.');
    return this.#container;
  }

  #requireContainer(): WebContainer {
    if (!this.#container) {
      throw new Error('Prepare the workspace before running a command.');
    }
    return this.#container;
  }

  #pipeOutput(process: WebContainerProcess, log: LogSink): void {
    void process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          log(stripAnsi(chunk));
        },
      }),
    );
  }
}
