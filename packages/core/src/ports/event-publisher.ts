export interface DomainEvent<TPayload = unknown> {
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
