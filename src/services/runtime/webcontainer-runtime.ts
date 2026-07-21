import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { WorkspaceFile } from '../../lib/workspace';
import { buildFileSystemTree } from './file-system-tree';

export type LogSink = (message: string) => void;

export class WebContainerRuntime {
  #container: WebContainer | null = null;
  #devProcess: WebContainerProcess | null = null;

  async prepare(files: WorkspaceFile[], log: LogSink): Promise<void> {
    const container = await this.#boot(log);
    log('Mounting workspace files...');
    await container.mount(buildFileSystemTree(files));
    log(`Mounted ${files.length} files.`);
  }

  async install(log: LogSink): Promise<void> {
    const container = this.#requireContainer();
    log('$ npm install');
    const process = await container.spawn('npm', ['install']);
    this.#pipeOutput(process, log);
    const exitCode = await process.exit;

    if (exitCode !== 0) {
      throw new Error(`npm install exited with code ${exitCode}.`);
    }

    log('Dependencies installed.');
  }

  async startDevServer(log: LogSink): Promise<string> {
    const container = this.#requireContainer();

    if (this.#devProcess) {
      await this.#devProcess.kill();
      this.#devProcess = null;
    }

    const serverReady = new Promise<string>((resolve) => {
      const unsubscribe = container.on('server-ready', (_port, url) => {
        unsubscribe();
        resolve(url);
      });
    });

    log('$ npm run dev -- --host 0.0.0.0');
    this.#devProcess = await container.spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0']);
    this.#pipeOutput(this.#devProcess, log);
    void this.#devProcess.exit.then((exitCode) => {
      log(`Dev server exited with code ${exitCode}.`);
      this.#devProcess = null;
    });

    return serverReady;
  }

  async readTextFile(path: string): Promise<string> {
    return this.#requireContainer().fs.readFile(path, 'utf-8');
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
          log(chunk);
        },
      }),
    );
  }
}
