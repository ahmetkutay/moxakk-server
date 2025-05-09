// filepath: /home/kutaykaracair/Projects/moxakk-server/services/proxy/ProxyService.ts
import logger from '../../utils/logger';

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: string;
}

export class ProxyService {
  private static instance: ProxyService;
  private proxies: ProxyConfig[] = [];
  private currentProxyIndex = 0;
  private proxyProvider: string;
  private isProxyEnabled = false;

  private constructor() {
    this.proxyProvider = process.env.PROXY_PROVIDER || 'manual';
    // USE_PROXY değişkeni 'true' değilse proxy'leri hiç yükleme
    this.isProxyEnabled = process.env.USE_PROXY === 'true';

    if (this.isProxyEnabled) {
      this.loadProxies();
    } else {
      logger.info('Proxy service is disabled. No proxies will be loaded.');
    }
  }

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  private loadProxies(): void {
    if (!this.isProxyEnabled) return;

    try {
      if (this.proxyProvider === 'manual') {
        // Manuel proxyleri ENV değişkeninden yükle
        const manualProxiesString = process.env.MANUAL_PROXIES || '';
        if (!manualProxiesString) {
          logger.warn('No manual proxies configured');
          return;
        }

        // Format: host1:port1:user1:pass1:protocol1,host2:port2:user2:pass2:protocol2,...
        const parsedProxies: ProxyConfig[] = [];

        manualProxiesString.split(',').forEach((proxyStr) => {
          const [host, portStr, username, password, protocol] = proxyStr.split(':');
          const port = parseInt(portStr, 10);

          if (!host || isNaN(port) || !protocol) {
            logger.warn(`Invalid proxy config: ${proxyStr}`);
            return; // continue ile aynı, forEach içinde
          }

          parsedProxies.push({
            host,
            port,
            username: username || undefined,
            password: password || undefined,
            protocol,
          });
        });

        this.proxies = parsedProxies;
        logger.info(`Loaded ${this.proxies.length} manual proxies`);
      } else if (this.proxyProvider === 'api') {
        // Gelecekte API tabanlı proxy sağlayıcıları için genişletilebilir
        logger.warn('API proxy provider not implemented yet');
      } else {
        logger.warn(`Unknown proxy provider: ${this.proxyProvider}`);
      }
    } catch (error) {
      logger.error(`Error loading proxies: ${error instanceof Error ? error.message : error}`);
    }
  }

  public async getNextProxy(): Promise<ProxyConfig | null> {
    // Eğer proxy devre dışıysa veya hiç proxy yoksa null dön
    if (!this.isProxyEnabled || this.proxies.length === 0) {
      return null;
    }

    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    const proxy = this.proxies[this.currentProxyIndex];

    logger.info(`Using proxy: ${proxy.host}:${proxy.port}`);
    return proxy;
  }

  public async testProxy(_proxy: ProxyConfig): Promise<boolean> {
    // Proxy devre dışıysa test etmeye gerek yok
    if (!this.isProxyEnabled) return false;

    // Gelecekte proxy test implementasyonu eklenebilir
    return true;
  }
}
