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
export class ApiError extends Error {
    constructor(message: string, public code = 'TECHNICAL', public fields: Record<string, string> = {}, public dishes: Entity[] = []) { super(message); }
}
const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3006/api';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    }
    catch (e) {
        if ((e as Error).name === 'AbortError')
            throw e;
        throw new ApiError('Không kết nối được API. Vui lòng thử lại.');
    }
    if (!res.ok)
        throw new ApiError('Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại.');
    let body;
    try {
        body = await res.json();
    }
    catch {
        throw new ApiError('Phản hồi máy chủ không hợp lệ.');
    }
    if (body?.ok === false && typeof body.error?.code === 'string')
        throw new ApiError(body.error.message, body.error.code, body.error.fields ?? {}, body.error.details?.dishes ?? []);
    if (body?.ok !== true || !('data' in body))
        throw new ApiError('Phản hồi máy chủ không hợp lệ.');
    const resource=path.split('/')[1]?.split('?')[0];
    const link=(v: any)=>v && Number.isInteger(v.id) && v.id>0 && typeof v.name==='string';
    const entity=(v: any)=>link(v) && (resource==='dishes'
      ? typeof v.description==='string' && typeof v.price==='string' && typeof v.category==='string' && typeof v.available==='boolean' && Array.isArray(v.chefs) && v.chefs.every((c:any)=>link(c)&&typeof c.specialty==='string') && Array.isArray(v.ingredients) && v.ingredients.every((i:any)=>link(i)&&typeof i.unit==='string')
      : Array.isArray(v.dishes) && v.dishes.every(link) && typeof v[resource==='chefs'?'specialty':'unit']==='string');
    const valid=options.method==='DELETE' ? body.data===null : Array.isArray(body.data) ? body.data.every(entity) : entity(body.data);
    if(!valid) throw new ApiError('Phản hồi máy chủ không hợp lệ.');
    return body.data;
}
export const labels: Record<Resource, string> = { dishes: 'món ăn', chefs: 'đầu bếp', ingredients: 'nguyên liệu' };
export const money = (value: string = '0') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));
