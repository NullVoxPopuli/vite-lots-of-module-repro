
import http2Proxy from 'http2-proxy';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

function getProxy() {
  function toHost(dest) {
    return {
      '/api': {
        target: dest,
        changeOrigin: true,
        ws: false,
      },
    };
  }

  if (process.env.PROXY_PORT) {
    return toHost(`http://localhost:${process.env.PROXY_PORT}`);
  }
}

function logProxyEnabled(data) {
  console.info(`
		Enabling Proxy to:
			${JSON.stringify(data)}
	`);
}

/**
 * Original implementation: https://github.com/vitejs/vite-plugin-basic-ssl/blob/main/src/index.ts
 *
 * Also: https://gist.github.com/xfournet/068592b3d1ddd488427b874b23f707bf
 *    and: https://gist.github.com/xfournet/068592b3d1ddd488427b874b23f707bf?permalink_comment_id=5050309#gistcomment-5050309
 *
 * Also: https://github.com/vitejs/vite/issues/2725
 */
export function h2proxy() {
  let proxy;

  return {
    name: 'auditboard:vite-h2-proxy',
    configResolved(config) {
      if (config.command === 'build') {
        return;
      }

      proxy = config.server?.proxy ?? getProxy();

      /**
       * We don't want vite to handle the proxy, else it disables http2
       */
      if (config.server) {
        delete config.server.proxy;
      }
    },
    /**
     * configureServer is not used for build
     */
    configureServer({ config, middlewares }) {
      const { logger } = config;
      if (!proxy) return;

      logProxyEnabled(proxy);

      Object.entries(proxy).forEach(([route, proxyOptions]) => {
        const options = getOptions(proxyOptions);

        middlewares.use(route, (req, res) => {
          const http2Options = {
            ...options,
          };

          if (typeof proxyOptions !== 'string') {
            if (proxyOptions.rewrite) {
              http2Options.path = proxyOptions.rewrite(req.originalUrl);
            } else {
              http2Options.path = req.originalUrl;
            }

            if (proxyOptions.configure) {
              proxyOptions.configure(http2Options, proxyOptions);
            }
          }

          http2Proxy.web(req, res, http2Options, (err) => {
            if (err) {
              logger.error(`[http2-proxy] Error when proxying request on '${req.originalUrl}'`, {
                timestamp: true,
                error: err,
              });
              logger.error(err);
            }
          });
        });
      });
    },
  };
}

const SECOND = 1000;
const HOUR = SECOND * 60 * 60;
const MONTH = HOUR * 24 * 30;

/**
 * @returns {Promise<{ cert: string, key: string }>}
 */
export async function getCertPair(cacheDir) {
  const keyPath = path.join(cacheDir, 'key.pem');
  const certPath = path.join(cacheDir, 'cert.pem');

  async function readFiles() {
    const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
    return { key, cert };
  }

  try {
    const [stats, content] = await Promise.all([stat(keyPath), readFiles()]);

    if (Date.now() - stats.ctime.valueOf() > MONTH) {
      throw new Error('cache is outdated.');
    }

    return content;
  } catch {
    await createCert(keyPath, certPath);

    return readFiles();
  }
}

function getOptions(proxyOptions) {
  if (typeof proxyOptions !== 'string') {
    const { protocol, hostname, port } = new URL(proxyOptions.target);
    const { proxyTimeout } = proxyOptions;

    return {
      protocol,
      hostname,
      port: Number(port),
      proxyTimeout,
      rejectUnauthorized: false,
    };
  }

  const { protocol, hostname, port } = new URL(proxyOptions);

  return {
    protocol,
    hostname,
    port: Number(port),
    proxyTimeout: 60000,
    rejectUnauthorized: false,
  };
}
