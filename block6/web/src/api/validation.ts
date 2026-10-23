import { ApiError } from './errors';
export function validateData(path: string, method: string | undefined, data: unknown) {
    const resource=path.split('/')[1]?.split('?')[0];
    const link=(v: any)=>v && Number.isInteger(v.id) && v.id>0 && typeof v.name==='string';
    const entity=(v: any)=>link(v) && (resource==='dishes'
      ? typeof v.description==='string' && typeof v.price==='string' && typeof v.category==='string' && typeof v.available==='boolean' && Array.isArray(v.chefs) && v.chefs.every((c:any)=>link(c)&&typeof c.specialty==='string') && Array.isArray(v.ingredients) && v.ingredients.every((i:any)=>link(i)&&typeof i.unit==='string')
      : Array.isArray(v.dishes) && v.dishes.every(link) && typeof v[resource==='chefs'?'specialty':'unit']==='string');
    const valid=method==='DELETE' ? data===null : Array.isArray(data) ? data.every(entity) : entity(data);
    if(!valid) throw new ApiError('Phản hồi máy chủ không hợp lệ.');
}
