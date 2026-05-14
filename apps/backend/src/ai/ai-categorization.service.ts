import Anthropic from '@anthropic-ai/sdk';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const CONFIDENCE_THRESHOLD = 0.6;

interface TripContext {
  id: string;
  title: string;
  description: string;
  destinationCountry: string;
  destinationName: string;
  transport: string;
  durationDays: number;
}

interface ModelResponse {
  categories: Array<{
    slug: string;
    confidence: number;
  }>;
}

@Injectable()
export class AICategorizationService implements OnModuleInit {
  private client: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Anthropic SDK initialized for AI categorization');
    } else {
      this.logger.log(
        'ANTHROPIC_API_KEY not set — AI categorization disabled',
      );
    }
  }

  /**
   * Fire-and-forget categorization. Caller should NOT await this in a
   * request path — let it run in the background. Errors are logged
   * and surfaced via Sentry through the global handler; the trip
   * remains uncategorized (still discoverable via filters, just
   * missing from category feeds).
   *
   * Async/BullMQ migration tracked in AGENTS §3 — this in-process
   * version is the MVP intermediate.
   */
  async categorizeTrip(tripId: string): Promise<void> {
    if (!this.client) return;
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        destinationCountry: true,
        destinationName: true,
        transport: true,
        durationDays: true,
      },
    });
    if (!trip) return;

    const categories = await this.prisma.category.findMany({
      select: { id: true, slug: true, labelPl: true, description: true },
    });
    if (categories.length === 0) return;

    let modelResponse: ModelResponse;
    try {
      modelResponse = await this.callModel(trip, categories);
    } catch (err) {
      this.logger.error(
        `[ai-categorize] trip=${tripId} model call failed: ${
          (err as Error)?.message ?? err
        }`,
      );
      return;
    }

    const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
    const matched = modelResponse.categories
      .filter((c) => c.confidence >= CONFIDENCE_THRESHOLD)
      .filter((c) => slugToId.has(c.slug))
      .map((c) => ({
        tripId: trip.id,
        categoryId: slugToId.get(c.slug) as string,
        confidence: c.confidence,
      }));

    if (matched.length === 0) {
      this.logger.warn(
        `[ai-categorize] trip=${tripId} no categories above threshold`,
      );
      return;
    }

    // Replace existing AI-sourced assignments. Manual overrides
    // (source != 'ai') will live in CategoryOverride once that's
    // wired — for now we only have 'ai' source.
    await this.prisma.tripCategory.deleteMany({
      where: { tripId, source: 'ai' },
    });
    await this.prisma.tripCategory.createMany({
      data: matched.map((m) => ({ ...m, source: 'ai' })),
    });

    this.logger.log(
      `[ai-categorize] trip=${tripId} → ${matched
        .map((m) => `${m.categoryId.slice(0, 6)}…(${m.confidence.toFixed(2)})`)
        .join(', ')}`,
    );
  }

  private async callModel(
    trip: TripContext,
    categories: { slug: string; labelPl: string; description: string | null }[],
  ): Promise<ModelResponse> {
    const client = this.client;
    if (!client) throw new Error('Anthropic client not initialized');

    const catalog = categories
      .map((c) => `- ${c.slug}: ${c.labelPl}${c.description ? ` — ${c.description}` : ''}`)
      .join('\n');

    const prompt = `Jesteś asystentem klasyfikującym wycieczki dla aplikacji Tripico.
Dla wycieczki podanej poniżej wybierz pasujące kategorie z listy. Dla każdej kategorii podaj confidence w przedziale 0.0–1.0.

WYCIECZKA:
- Tytuł: ${trip.title}
- Opis: ${trip.description}
- Cel: ${trip.destinationName} (${trip.destinationCountry})
- Transport: ${trip.transport}
- Długość: ${trip.durationDays} dni

DOSTĘPNE KATEGORIE:
${catalog}

Zwróć WYŁĄCZNIE JSON w formacie:
{"categories":[{"slug":"<slug>","confidence":0.0}]}

Wybieraj kategorie zachowawczo — tylko te, które naprawdę pasują.`;

    const message = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Anthropic response had no text block');
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from model response');
    }
    return JSON.parse(jsonMatch[0]) as ModelResponse;
  }
}
