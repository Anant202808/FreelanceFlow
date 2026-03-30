// types.ts — Re-exports from store for backwards compatibility
// All types now live in store.ts and match the MongoDB backend exactly

export type { AuthUser as User, Client, Project, Task, TimeLog, Invoice, InvoiceLineItem, DashboardStats } from './store';
