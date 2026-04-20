// Re-export directly from the base store.
// The base store in index.ts already has correct addMessage, removeMessage,
// and reconcileOptimistic implementations — no patch layer needed.
// The previous module-level `patched` flag broke hot-reload in dev mode.
export { useChatStore } from '@/store';
