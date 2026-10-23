export type Resource = 'dishes' | 'chefs' | 'ingredients';
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
