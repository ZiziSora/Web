// Public API facade: network code, DTOs and display helpers live in separate modules.
export { api } from './api/client';
export { ApiError } from './api/errors';
export { labels } from './config/labels';
export type { Entity,Resource } from './types/api';
export { money } from './utils/money';
