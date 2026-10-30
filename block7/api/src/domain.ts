export const resources = ['dishes', 'chefs', 'ingredients'] as const;
export type Resource = typeof resources[number];
export interface Related {
    id: number;
    name: string;
    unit?: string;
    specialty?: string;
}
export interface Entity extends Related {
    description?: string;
    price?: string;
    category?: string;
    available?: boolean;
    specialty?: string;
    chefs?: Related[];
    ingredients?: Related[];
    dishes?: Related[];
}
export interface EntityInput {
    name: string;
    description: string;
    price: string;
    category: string;
    available: boolean;
    specialty: string;
    unit: string;
    chefIds: number[];
    ingredientIds: number[];
}
export interface FormValues {
    name: string;
    description: string;
    price: string;
    category: string;
    available: string;
    specialty: string;
    unit: string;
    chefIds: string[];
    ingredientIds: string[];
}
export type Errors = Partial<Record<keyof FormValues | 'form', string>>;
export class InputError extends Error {
    constructor(public errors: Errors) { super('Invalid input'); }
}
export class NotFoundError extends Error {
}
export class IngredientInUseError extends Error {
    constructor(public dishes: Related[]) { super('Ingredient in use'); }
}
export interface RestaurantStore {
    list(resource: Resource, q?: string): Promise<Entity[]>;
    find(resource: Resource, id: number): Promise<Entity | null>;
    create(resource: Resource, input: EntityInput): Promise<Entity>;
    update(resource: Resource, id: number, input: Partial<EntityInput>): Promise<Entity>;
    delete(resource: Resource, id: number): Promise<void>;
}
export const labels: Record<Resource, {
    singular: string;
    plural: string;
    eyebrow: string;
}> = {
    dishes: { singular: 'món ăn', plural: 'Món ăn', eyebrow: 'THỰC ĐƠN' },
    chefs: { singular: 'đầu bếp', plural: 'Đầu bếp', eyebrow: 'CON NGƯỜI' },
    ingredients: { singular: 'nguyên liệu', plural: 'Nguyên liệu', eyebrow: 'CĂN BẾP' },
};
export const money = (value: string | number = 0) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));
export function parseId(value: unknown): number | null {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
        return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}
export function formValues(body: Record<string, unknown> = {}): FormValues {
    const str = (key: string) => typeof body[key] === 'string' ? body[key] as string : '';
    const ids = (key: string) => {
        const value = body[key];
        return value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(v => typeof v === 'string' ? v : 'invalid');
    };
    return {
        name: str('name'), description: str('description'), price: str('price'),
        category: str('category'), available: str('available'), specialty: str('specialty'),
        unit: str('unit'), chefIds: ids('chefIds'), ingredientIds: ids('ingredientIds'),
    };
}
export function entityValues(entity?: Entity): FormValues {
    return {
        name: entity?.name ?? '', description: entity?.description ?? '', price: entity?.price ?? '',
        category: entity?.category ?? '', available: String(entity?.available ?? true),
        specialty: entity?.specialty ?? '', unit: entity?.unit ?? '',
        chefIds: entity?.chefs?.map(c => String(c.id)) ?? [],
        ingredientIds: entity?.ingredients?.map(i => String(i.id)) ?? [],
    };
}
export function validate(resource: Resource, values: FormValues): EntityInput {
    const errors: Errors = {};
    const required = (key: 'name' | 'description' | 'category' | 'specialty' | 'unit', max: number, label: string) => {
        if (!values[key].trim())
            errors[key] = `Vui lòng nhập ${label}.`;
        else if (values[key].trim().length > max)
            errors[key] = `${label} tối đa ${max} ký tự.`;
    };
    required('name', 120, 'tên');
    if (resource === 'dishes') {
        required('description', 2000, 'mô tả');
        required('category', 80, 'danh mục');
        if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.price.trim()))
            errors.price = 'Giá phải là số không âm, tối đa 10 chữ số và 2 chữ số thập phân.';
        if (!['true', 'false'].includes(values.available))
            errors.available = 'Vui lòng chọn trạng thái hợp lệ.';
        if (values.chefIds.some(v => parseId(v) === null))
            errors.chefIds = 'Lựa chọn đầu bếp không hợp lệ.';
        if (values.ingredientIds.some(v => parseId(v) === null))
            errors.ingredientIds = 'Lựa chọn nguyên liệu không hợp lệ.';
    }
    if (resource === 'chefs')
        required('specialty', 200, 'chuyên môn');
    if (resource === 'ingredients')
        required('unit', 40, 'đơn vị');
    if (Object.keys(errors).length)
        throw new InputError(errors);
    return {
        name: values.name.trim(), description: values.description.trim(), price: values.price.trim(),
        category: values.category.trim(), available: values.available === 'true',
        specialty: values.specialty.trim(), unit: values.unit.trim(),
        chefIds: [...new Set(values.chefIds.map(Number))],
        ingredientIds: [...new Set(values.ingredientIds.map(Number))],
    };
}
export function jsonInput(resource: Resource, body: unknown, partial = false): Partial<EntityInput> {
    if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new InputError({ form: 'Dữ liệu phải là JSON object.' });
    const b = body as Record<string, unknown>;
    const keys = resource === 'dishes' ? ['name', 'description', 'price', 'category', 'available', 'chefIds', 'ingredientIds'] : resource === 'chefs' ? ['name', 'specialty'] : ['name', 'unit'];
    const out: Record<string, unknown> = {};
    const errors: Errors = {};
    for (const key of keys) {
        if (partial && !(key in b))
            continue;
        const v = b[key];
        if (key === 'available') {
            if (v !== undefined && typeof v !== 'boolean')
                errors.available = 'Trạng thái phải là boolean.';
            out[key] = v ?? true;
        }
        else if (key.endsWith('Ids')) {
            if (v !== undefined && (!Array.isArray(v) || v.some(id => typeof id !== 'number' || parseId(String(id)) === null)))
                errors[key as 'chefIds'] = 'ID quan hệ không hợp lệ.';
            out[key] = Array.isArray(v) ? [...new Set(v)] : [];
        }
        else {
            if (typeof v !== 'string')
                errors[key as 'name'] = 'Vui lòng nhập văn bản hợp lệ.';
            out[key] = typeof v === 'string' ? v.trim() : '';
        }
    }
    if (partial && !Object.keys(out).length)
        errors.form = 'Không có trường cập nhật.';
    if (Object.keys(errors).length)
        throw new InputError(errors);
    const full = { ...entityValues(), ...out, available: String(out.available ?? true), chefIds: ((out.chefIds ?? []) as number[]).map(String), ingredientIds: ((out.ingredientIds ?? []) as number[]).map(String) };
    if (!partial)
        return validate(resource, full as FormValues);
    // Validate only supplied fields; valid placeholders cover omitted required fields.
    validate(resource, { name: 'x', description: 'x', price: '0', category: 'x', specialty: 'x', unit: 'x', available: 'true', chefIds: [], ingredientIds: [], ...Object.fromEntries(Object.entries(full).filter(([key]) => key in out)) } as FormValues);
    return out as Partial<EntityInput>;
}
