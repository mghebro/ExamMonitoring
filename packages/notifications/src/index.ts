export interface NotificationDispatcher {
  dispatchPendingOutbox(): Promise<number>;
}
