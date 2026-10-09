import type { Options } from 'storybook/internal/types';

import type { Server } from 'http';
import type { InlineConfig, ServerOptions } from 'vite';

import { createViteLogger } from './logger.ts';
import { commonConfig } from './vite-config.ts';

export async function createViteServer(options: Options, devServer: Server) {
  const { presets } = options;

  const commonCfg = await commonConfig(options, 'development');

  const { allowedHosts } = await presets.apply('core', {});

  const config: InlineConfig & { server: ServerOptions } = {
    ...commonCfg,
    server: {
      allowedHosts,
      middlewareMode: true,
      // Vite doesn't listen on this port in middleware mode. The HMR client only uses it as the
      // direct fallback target when the page-derived WebSocket connection fails.
      port: options.port,
      // HMR shares Storybook's HTTP server. Leaving `hmr.port` unset lets the Vite client derive
      // the WebSocket host and port from the page URL, so HMR also works behind reverse proxies
      // that serve Storybook on a different port.
      hmr: {
        server: devServer,
      },
      fs: {
        strict: true,
      },
    },
    appType: 'custom' as const,
  };

  // '0.0.0.0' binds to all interfaces, which is useful for Docker and other containerized environments
  if (
    options.host === '0.0.0.0' &&
    (!allowedHosts || (Array.isArray(allowedHosts) && allowedHosts.length === 0))
  ) {
    config.server.allowedHosts = true;
  }

  const finalConfig = await presets.apply('viteFinal', config, options);

  const { createServer } = await import('vite');

  finalConfig.customLogger ??= await createViteLogger();
  return createServer(finalConfig);
}
