import { createServer as createHttpServer } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import type { Options, Presets } from 'storybook/internal/types';

import { type InlineConfig, createServer } from 'vite';

import { createViteServer } from './vite-server.ts';

vi.mock('vite', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vite')>()),
  createServer: vi.fn(async (config: InlineConfig) => config),
}));
vi.mock('./vite-config.ts', () => ({
  commonConfig: vi.fn(async () => ({})),
}));
vi.mock('./logger.ts', () => ({
  createViteLogger: vi.fn(async () => undefined),
}));

const createOptions = (viteFinal = (config: InlineConfig) => config): Options => ({
  configType: 'DEVELOPMENT',
  configDir: '',
  packageJson: {},
  port: 6006,
  channel: new Channel({}),
  presets: {
    apply: async (key: string, config: unknown) => {
      if (key === 'core') {
        return {};
      }
      if (key === 'viteFinal') {
        return viteFinal(config as InlineConfig);
      }
      return config;
    },
  } as Presets,
  presetsList: [],
});

const getServerConfig = () => vi.mocked(createServer).mock.lastCall?.[0]?.server;

describe('createViteServer', () => {
  it('should attach HMR to the Storybook server without pinning the client port', async () => {
    const devServer = createHttpServer();

    await createViteServer(createOptions(), devServer);

    // Without `hmr.port`, the Vite client derives the HMR socket address from the page URL,
    // which keeps HMR working behind reverse proxies that expose a different port.
    expect(getServerConfig()?.hmr).toStrictEqual({ server: devServer });
    // The local port remains the HMR client's direct fallback target.
    expect(getServerConfig()?.port).toBe(6006);
  });

  it('should keep HMR options set in viteFinal', async () => {
    const devServer = createHttpServer();

    await createViteServer(
      createOptions((config) => ({
        ...config,
        server: { ...config.server, hmr: { clientPort: 443, server: devServer } },
      })),
      devServer
    );

    expect(getServerConfig()?.hmr).toStrictEqual({ clientPort: 443, server: devServer });
  });
});
