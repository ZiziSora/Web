import type { ListQuery, OptionsQuery, OptionsPage, Page } from '../src/list-query.js';
import { IngredientInUseError, InputError, NotFoundError, type Entity, type EntityInput, type Resource, type RestaurantStore } from '../src/domain.js';
/** HTTP tests use an isolated store; database tests verify the real Prisma implementation. */
export class MemoryStore implements RestaurantStore {
    rows: Record<Resource, Entity[]> = {
        dishes: [{ id: 1, name: 'Bò lúc lắc', description: 'Bò mềm, hành giòn.', price: '165000', category: 'Món Việt', available: true, chefs: [{ id: 1, name: 'An' }], ingredients: [{ id: 1, name: 'Hành tây', unit: 'kg' }] }],
        chefs: [{ id: 1, name: 'An', specialty: 'Món Việt' }],
        ingredients: [{ id: 1, name: 'Hành tây', unit: 'kg' }],
    };
    // Fixture behavior only; full-text ranking/trigrams are verified against PostgreSQL.
    async list(resource: Resource, query: ListQuery): Promise<Page<Entity>> {
        const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
        let effectiveMode = query.mode;
        let rows = this.rows[resource].filter(row => {
            const document = query.mode === 'fulltext' ? row.name + ' ' + (row.description ?? '') : row.name;
            const matches = query.mode === 'fuzzy' ? false : query.mode === 'fulltext' ? norm(query.q).split(/\s+/).every(token => norm(document).includes(token)) : norm(document).includes(norm(query.q));
            return (!query.q || matches) && (!query.category || row.category === query.category)
              && (query.minPrice === undefined || Number(row.price) >= Number(query.minPrice))
              && (query.maxPrice === undefined || Number(row.price) <= Number(query.maxPrice))
              && (query.available === undefined || row.available === query.available);
        });
        if (!rows.length && query.q && query.mode === 'fulltext' && query.fallback) effectiveMode = 'fuzzy';
        rows = rows.sort((a, b) => {
            let order = 0;
            if (query.sort.startsWith('name')) order = norm(a.name).localeCompare(norm(b.name));
            if (query.sort.startsWith('price')) order = Number(a.price) - Number(b.price);
            if (query.sort.endsWith('desc')) order = -order;
            return order || a.id - b.id;
        });
        const total = rows.length, pages = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, pages);
        return { items: rows.slice((page - 1) * query.pageSize, page * query.pageSize).map(row => this.hydrate(resource, row)), meta: { page, pageSize: query.pageSize, pages, total, effectiveMode } };
    }
    async options(resource: 'chefs' | 'ingredients', query: OptionsQuery): Promise<OptionsPage> {
        const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
        const rows = this.rows[resource].filter(row => row.id > query.after && norm(row.name).includes(norm(query.q))).sort((a, b) => a.id - b.id);
        const items = rows.slice(0, query.limit).map(({ id, name, unit, specialty }) => ({ id, name, ...(unit === undefined ? {} : { unit }), ...(specialty === undefined ? {} : { specialty }) }));
        const hasMore = rows.length > query.limit;
        return { items, hasMore, nextCursor: hasMore ? items.at(-1)!.id : null };
    }
    async facets() { return { categories: [...new Set(this.rows.dishes.map(row => row.category!))].sort() }; }
    private hydrate(resource: Resource, row: Entity): Entity {
        const entity = structuredClone(row);
        if(resource==='dishes') {
          entity.chefs=entity.chefs?.map(link=>{const c=this.rows.chefs.find(c=>c.id===link.id)!;return {id:c.id,name:c.name,specialty:c.specialty};})??[];
          entity.ingredients=entity.ingredients?.map(link=>{const i=this.rows.ingredients.find(i=>i.id===link.id)!;return {id:i.id,name:i.name,unit:i.unit};})??[];
        }
        if (resource !== 'dishes')
            entity.dishes = this.rows.dishes.filter(d => (resource === 'chefs' ? d.chefs : d.ingredients)?.some(r => r.id === row.id)).map(d => ({ id: d.id, name: d.name }));
        return entity;
    }
    async find(resource: Resource, id: number) {
        const row = this.rows[resource].find(e => e.id === id);
        return row ? this.hydrate(resource, row) : null;
    }
    private data(resource: Resource, input: EntityInput): Omit<Entity, 'id'> {
        if (resource === 'chefs')
            return { name: input.name, specialty: input.specialty };
        if (resource === 'ingredients')
            return { name: input.name, unit: input.unit };
        if (input.chefIds.some(id => !this.rows.chefs.some(c => c.id === id)))
            throw new InputError({ chefIds: 'Đầu bếp không tồn tại.' });
        if (input.ingredientIds.some(id => !this.rows.ingredients.some(c => c.id === id)))
            throw new InputError({ ingredientIds: 'Nguyên liệu không tồn tại.' });
        return {
            name: input.name, description: input.description, price: input.price, category: input.category, available: input.available,
            chefs: this.rows.chefs.filter(c => input.chefIds.includes(c.id)).map(c => ({ id: c.id, name: c.name, specialty: c.specialty })),
            ingredients: this.rows.ingredients.filter(c => input.ingredientIds.includes(c.id)).map(c => ({ id: c.id, name: c.name, unit: c.unit })),
        };
    }
    async create(resource: Resource, input: EntityInput) {
        const row = { ...this.data(resource, input), id: Math.max(0, ...this.rows[resource].map(e => e.id)) + 1 };
        this.rows[resource].push(row);
        return this.hydrate(resource, row);
    }
    async update(resource: Resource, id: number, patch: Partial<EntityInput>) {
        const current = await this.find(resource, id);
        if (!current)
            throw new NotFoundError();
        const input = { ...current, chefIds: current.chefs?.map(c => c.id) ?? [], ingredientIds: current.ingredients?.map(i => i.id) ?? [], ...patch } as EntityInput;
        const index = this.rows[resource].findIndex(e => e.id === id);
        if (index < 0)
            throw new NotFoundError();
        const row = { id, ...this.data(resource, input) };
        this.rows[resource][index] = row;
        return this.hydrate(resource, row);
    }
    async delete(resource: Resource, id: number) {
        const entity = await this.find(resource, id);
        if (!entity)
            throw new NotFoundError();
        if (resource === 'ingredients' && entity.dishes?.length)
            throw new IngredientInUseError(entity.dishes);
        this.rows[resource] = this.rows[resource].filter(e => e.id !== id);
        if (resource === 'chefs')
            this.rows.dishes.forEach(d => { d.chefs = d.chefs?.filter(c => c.id !== id); });
    }
}
