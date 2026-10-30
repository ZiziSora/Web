export type Resource = 'dishes' | 'chefs' | 'ingredients';
export interface Page<T> {
    items: T[];
    meta: { page: number; pageSize: number; total: number; pages: number; effectiveMode: 'basic' | 'advanced' | 'fulltext' | 'fuzzy' };
}
export interface Option { id: number; name: string; unit?: string; specialty?: string }
export interface OptionsPage { items: Option[]; nextCursor: number | null; hasMore: boolean }
export interface Entity {
    id: number;
    name: string;
    description?: string;
    price?: string;
    category?: string;
    available?: boolean;
    specialty?: string;
    unit?: string;
    chefs?: Entity[];
    ingredients?: Entity[];
    dishes?: Entity[];
}
