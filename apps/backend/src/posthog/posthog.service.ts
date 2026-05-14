import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PostHog } from 'posthog-node';

@Injectable()
export class PostHogService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PostHogService.name);
  private client: PostHog | null = null;

  onModuleInit(): void {
    const apiKey = process.env['POSTHOG_API_KEY'];
    const host = process.env['POSTHOG_HOST'] ?? 'https://eu.i.posthog.com';
    if (!apiKey) {
      this.logger.log(
        'POSTHOG_API_KEY not set — analytics disabled (no-op capture).',
      );
      return;
    }
    this.client = new PostHog(apiKey, {
      host,
      // Low MVP volume — flush quickly so events appear in the dashboard
      // without waiting for the default 10s/20-event batch.
      flushAt: 1,
      flushInterval: 1000,
    });
    this.logger.log(`PostHog initialized (host=${host})`);
  }

  /**
   * Capture a domain event tied to a known user. Silently no-ops when
   * POSTHOG_API_KEY isn't set (dev, CI, smoke tests).
   */
  capture(params: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void {
    if (!this.client) return;
    try {
      this.client.capture({
        distinctId: params.distinctId,
        event: params.event,
        properties: params.properties ?? {},
      });
    } catch (err) {
      this.logger.warn(
        `PostHog capture failed (event=${params.event}): ${
          (err as Error)?.message ?? err
        }`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.shutdown();
    } catch {
      // ignore — shutdown is best-effort
    }
  }
}
