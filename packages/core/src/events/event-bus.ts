/**
 * In-memory event bus for component communication
 *
 * Design rationale:
 * - Decouples components (gateway, agent, tools don't know about each other)
 * - Enables async processing
 * - Simple to upgrade to Redis pub/sub later
 * - Type-safe subscriptions
 */

import type { Event, EventType } from "../types.js";

type EventHandler<T extends Event = Event> = (event: T) => void | Promise<void>;

interface Subscription {
  id: string;
  eventType: EventType | "*";
  handler: EventHandler;
}

/**
 * Singleton event bus for system-wide communication
 */
export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private globalSubscriptions: Subscription[] = [];
  private nextSubscriptionId = 0;

  /**
   * Subscribe to a specific event type
   *
   * @param eventType - Event type to listen for, or "*" for all events
   * @param handler - Callback function to handle events
   * @returns Unsubscribe function
   */
  subscribe<T extends Event = Event>(
    eventType: EventType | "*",
    handler: EventHandler<T>,
  ): () => void {
    const subscription: Subscription = {
      id: `sub_${this.nextSubscriptionId++}`,
      eventType,
      handler: handler as EventHandler,
    };

    if (eventType === "*") {
      this.globalSubscriptions.push(subscription);
    } else {
      const subs = this.subscriptions.get(eventType) || [];
      subs.push(subscription);
      this.subscriptions.set(eventType, subs);
    }

    // Return unsubscribe function
    return () => {
      if (eventType === "*") {
        const index = this.globalSubscriptions.findIndex(
          (s) => s.id === subscription.id,
        );
        if (index !== -1) {
          this.globalSubscriptions.splice(index, 1);
        }
      } else {
        const subs = this.subscriptions.get(eventType);
        if (subs) {
          const index = subs.findIndex((s) => s.id === subscription.id);
          if (index !== -1) {
            subs.splice(index, 1);
          }
        }
      }
    };
  }

  /**
   * Publish an event to all subscribers
   *
   * @param event - Event to publish
   */
  async publish(event: Event): Promise<void> {
    // Get specific subscribers
    const specificSubs = this.subscriptions.get(event.type) || [];

    // Combine with global subscribers
    const allSubs = [...specificSubs, ...this.globalSubscriptions];

    // Execute all handlers (async but don't wait)
    const promises = allSubs.map((sub) => {
      try {
        return Promise.resolve(sub.handler(event));
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
        return Promise.resolve();
      }
    });

    // Wait for all handlers to complete
    await Promise.allSettled(promises);
  }

  /**
   * Get count of subscribers for an event type
   */
  getSubscriberCount(eventType: EventType): number {
    return (this.subscriptions.get(eventType) || []).length;
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void {
    this.subscriptions.clear();
    this.globalSubscriptions = [];
  }
}

// Export singleton instance
export const eventBus = new EventBus();
