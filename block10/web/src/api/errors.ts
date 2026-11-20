import type { Entity } from '../types/api';
export class ApiError extends Error {
    constructor(message: string, public code = 'TECHNICAL', public fields: Record<string, string> = {}, public dishes: Entity[] = [],
      public status = 0, public retryAfter = 0, public captchaRequired = false) { super(message); }
}
