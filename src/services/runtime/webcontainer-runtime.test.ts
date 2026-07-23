import { describe, expect, it, vi } from 'vitest';
import {
  RuntimeOperationError,
  type RuntimeContainer,
  type RuntimeProcess,
  WebContainerRuntime,
} from './webcontainer-runtime';

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
} {
  const result = {} as {
    promise: Promise<T>;
    reject: (reason?: unknown) => void;
    resolve: (value: T) => void;
  };
  result.promise = new Promise<T>((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
}

function createProcess(exit: Promise<number> = new Promise(() => undefined)): RuntimeProcess {
  return {
    exit,
    kill: vi.fn().mockResolvedValue(undefined),
    output: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
  };
}

function createContainer(process: RuntimeProcess): {
  container: RuntimeContainer;
  notifyServerReady: (url: string) => void;
} {
  let listener: (port: number, url: string) => void = () => undefined;
  return {
    container: {
      fs: { readFile: vi.fn().mockResolvedValue('') },
      mount: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((_event, nextListener) => {
        listener = nextListener;
        return vi.fn();
      }),
      spawn: vi.fn().mockResolvedValue(process),
    },
    notifyServerReady: (url) => listener(5173, url),
  };
}

function runtimeFor(container: RuntimeContainer, dependencies = {}) {
  return new WebContainerRuntime({
    boot: vi.fn().mockResolvedValue(container),
    crossOriginIsolated: () => true,
    isSecureContext: () => true,
    sharedArrayBuffer: () => true,
    ...dependencies,
  });
}

describe('WebContainerRuntime', () => {
  it('does not boot when cross-origin isolation is unavailable', async () => {
    const runtime = new WebContainerRuntime({ crossOriginIsolated: () => false });

    await expect(runtime.prepare([], vi.fn())).rejects.toMatchObject({
      code: 'runtime-unavailable',
    } satisfies Partial<RuntimeOperationError>);
  });

  it('reports an early dev-server exit instead of waiting forever', async () => {
    const exit = deferred<number>();
    const process = createProcess(exit.promise);
    const { container } = createContainer(process);
    const runtime = runtimeFor(container);
    await runtime.prepare([], vi.fn());

    const starting = runtime.startDevServer(vi.fn());
    exit.resolve(1);

    await expect(starting).rejects.toMatchObject({
      code: 'server-exited-before-ready',
    } satisfies Partial<RuntimeOperationError>);
  });

  it('resolves only when the runtime reports a ready server', async () => {
    const process = createProcess();
    const { container, notifyServerReady } = createContainer(process);
    const runtime = runtimeFor(container);
    await runtime.prepare([], vi.fn());

    const starting = runtime.startDevServer(vi.fn());
    await Promise.resolve();
    notifyServerReady('https://example.webcontainer.io');

    await expect(starting).resolves.toBe('https://example.webcontainer.io');
  });

  it('terminates a pending startup on cancellation', async () => {
    const process = createProcess();
    const { container } = createContainer(process);
    const runtime = runtimeFor(container);
    const controller = new AbortController();
    await runtime.prepare([], vi.fn());

    const starting = runtime.startDevServer(vi.fn(), { signal: controller.signal });
    await Promise.resolve();
    controller.abort();

    await expect(starting).rejects.toMatchObject({
      code: 'cancelled',
    } satisfies Partial<RuntimeOperationError>);
    expect(process.kill).toHaveBeenCalledOnce();
  });

  it('bounds startup with a timeout', async () => {
    const process = createProcess();
    const { container } = createContainer(process);
    let fireTimeout = (): void => undefined;
    const runtime = runtimeFor(container, {
      setTimeout: ((handler: () => void) => {
        fireTimeout = handler;
        return 0;
      }) as typeof globalThis.setTimeout,
      clearTimeout: vi.fn() as unknown as typeof globalThis.clearTimeout,
    });
    await runtime.prepare([], vi.fn());

    const starting = runtime.startDevServer(vi.fn(), { timeoutMs: 30_000 });
    await Promise.resolve();
    fireTimeout();

    await expect(starting).rejects.toMatchObject({
      code: 'server-start-timeout',
    } satisfies Partial<RuntimeOperationError>);
    expect(process.kill).toHaveBeenCalledOnce();
  });
});
