export * from "./linking.js";

export interface NotificationDispatcher {
  dispatchPendingOutbox(): Promise<number>;
}
