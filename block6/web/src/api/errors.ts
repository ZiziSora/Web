import type { Entity } from '../types/api';
export class ApiError extends Error {
    constructor(message: string, public code = 'TECHNICAL', public fields: Record<string, string> = {}, public dishes: Entity[] = []) { super(message); }
}
