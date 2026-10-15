export * from "./linking.js";
export * from "./bot-client.js";
export * from "./router.js";

export interface NotificationDispatcher {
  dispatchPendingOutbox(): Promise<number>;
}
