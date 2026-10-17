import type { DomainEvent, EventPublisher } from '@assets-pipeline/core';

/**
 * Opt-in event log for debugging the domain workflow:
 * set `ASSETS_PIPELINE_EVENTS=1` to print one line per completed fact.
 */
export function createNodeEventPublisher(): EventPublisher | undefined {
  if (process.env.ASSETS_PIPELINE_EVENTS !== '1') return undefined;
  return {
    async publish(event: DomainEvent): Promise<void> {
      process.stderr.write(`event ${event.type} ${JSON.stringify(event.payload)}\n`);
    },
  };
}
