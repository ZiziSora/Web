import type { ListQuery, Page, OptionsQuery, OptionsPage, Option } from './list-query.js';
import { quoteIdentifier } from './search-setup.js';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { IngredientInUseError, InputError, NotFoundError, type Entity, type EntityInput, type Resource, type RestaurantStore, } from './domain.js';
const relations = { chefs: { orderBy: { name: 'asc' as const } }, ingredients: { orderBy: { name: 'asc' as const } } };
const dishLinks = { dishes: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } } };
const normalize = (row: Record<string, unknown>): Entity => ({
    ...row, ...(row.price !== undefined ? { price: String(row.price) } : {}),
}) as unknown as Entity;
export class PrismaRestaurantStore implements RestaurantStore {
    constructor(private db: PrismaClient, private schema = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/table').searchParams.get('schema') ?? 'public') { }
    async all(resource: 'chefs' | 'ingredients'): Promise<Entity[]> {
        const rows = resource === 'chefs'
            ? await this.db.chef.findMany({ include: dishLinks, orderBy: { id: 'asc' } })
            : await this.db.ingredient.findMany({ include: dishLinks, orderBy: { id: 'asc' } });
        return rows.map(normalize);
    }
    async allOptions(resource: 'chefs' | 'ingredients'): Promise<Option[]> {
        return resource === 'chefs'
            ? this.db.chef.findMany({ select: { id: true, name: true, specialty: true }, orderBy: { id: 'asc' } })
            : this.db.ingredient.findMany({ select: { id: true, name: true, unit: true }, orderBy: { id: 'asc' } });
    }
    private table(resource: Resource) {
        return Prisma.raw(quoteIdentifier(this.schema) + '.' + quoteIdentifier({ dishes: 'Dish', chefs: 'Chef', ingredients: 'Ingredient' }[resource]));
    }
    private normal(value: string) {
        return Prisma.sql`${Prisma.raw(quoteIdentifier(this.schema) + '.search_normalize')}(${value})`;
    }
    private async searchPath(tx: Prisma.TransactionClient) {
        // Extension namespaces may differ on existing Supabase databases.
        await tx.$queryRaw`SELECT set_config('search_path', ${quoteIdentifier(this.schema)} || ',pg_catalog,' ||
          (SELECT string_agg(quote_ident(n.nspname), ',') FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname IN ('unaccent','pg_trgm')), true),
          set_config('pg_trgm.similarity_threshold', '0.3', true)`;
    }
    private conditions(resource: Resource, query: ListQuery) {
        const clauses: Prisma.Sql[] = [Prisma.sql`true`];
        let score = Prisma.sql`0`;
        if (query.q) {
            const term = this.normal(query.q);
            if (query.mode === 'fulltext') {
                const tsquery = Prisma.sql`websearch_to_tsquery('simple', ${term})`;
                clauses.push(Prisma.sql`"searchVector" @@ ${tsquery}`);
                score = Prisma.sql`ts_rank("searchVector", ${tsquery})`;
            } else if (query.mode === 'fuzzy') {
                // % uses the trigram GIN index; >= publishes the inclusive boundary.
                clauses.push(Prisma.sql`"searchName" % ${term} AND similarity("searchName", ${term}) >= 0.3::real`);
                score = Prisma.sql`similarity("searchName", ${term})`;
            } else {
                const escaped = query.q.replace(/[\\%_]/g, '\\$&');
                clauses.push(Prisma.sql`"searchName" LIKE ('%' || ${this.normal(escaped)} || '%')`);
            }
        }
        if (resource === 'dishes') {
            if (query.category) clauses.push(Prisma.sql`category = ${query.category}`);
            if (query.minPrice !== undefined) clauses.push(Prisma.sql`price >= ${query.minPrice}::numeric`);
            if (query.maxPrice !== undefined) clauses.push(Prisma.sql`price <= ${query.maxPrice}::numeric`);
            if (query.available !== undefined) clauses.push(Prisma.sql`available = ${query.available}`);
        }
        const sorts = { id: Prisma.sql`id ASC`, 'name-asc': Prisma.sql`"searchName" ASC, id ASC`, 'name-desc': Prisma.sql`"searchName" DESC, id ASC`, 'price-asc': Prisma.sql`price ASC, id ASC`, 'price-desc': Prisma.sql`price DESC, id ASC` };
        return { where: Prisma.join(clauses, ' AND '), order: query.q && ['fulltext', 'fuzzy'].includes(query.mode) ? Prisma.sql`${score} DESC, id ASC` : sorts[query.sort] };
    }
    async list(resource: Resource, query: ListQuery): Promise<Page<Entity>> {
        return this.db.$transaction(async tx => {
            await this.searchPath(tx);
            let effectiveMode = query.mode;
            let conditions = this.conditions(resource, query);
            const count = async () => Number((await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM ${this.table(resource)} WHERE ${conditions.where}`))[0].total);
            let total = await count();
            if (!total && query.q && query.mode === 'fulltext' && query.fallback) {
                effectiveMode = 'fuzzy';
                conditions = this.conditions(resource, { ...query, mode: 'fuzzy' });
                total = await count();
            }
            const pages = Math.max(1, Math.ceil(total / query.pageSize));
            const page = Math.min(query.page, pages);
            const ids = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT id FROM ${this.table(resource)} WHERE ${conditions.where} ORDER BY ${conditions.order} LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`);
            const where = { id: { in: ids.map(row => row.id) } };
            const rows = resource === 'dishes' ? await tx.dish.findMany({ where, include: relations }) : resource === 'chefs' ? await tx.chef.findMany({ where, include: dishLinks }) : await tx.ingredient.findMany({ where, include: dishLinks });
            const indexed = new Map(rows.map(row => [row.id, normalize(row)]));
            return { items: ids.map(({ id }) => indexed.get(id)!), meta: { page, pageSize: query.pageSize, total, pages, effectiveMode } };
        }, { isolationLevel: 'RepeatableRead', maxWait: 30000, timeout: 30000 });
    }
    async options(resource: 'chefs' | 'ingredients', query: OptionsQuery): Promise<OptionsPage> {
        return this.db.$transaction(async tx => {
            const term = this.normal(query.q.replace(/[\\%_]/g, '\\$&'));
            const extra = Prisma.raw(resource === 'chefs' ? 'specialty' : 'unit');
            const rows = await tx.$queryRaw<Option[]>(Prisma.sql`SELECT id, name, ${extra} FROM ${this.table(resource)} WHERE id > ${query.after} AND "searchName" LIKE ('%' || ${term} || '%') ORDER BY id ASC LIMIT ${query.limit + 1}`);
            const hasMore = rows.length > query.limit;
            const items = rows.slice(0, query.limit);
            return { items, nextCursor: hasMore ? items.at(-1)!.id : null, hasMore };
        }, { isolationLevel: 'RepeatableRead', maxWait: 30000, timeout: 30000 });
    }
    async facets() {
        return { categories: (await this.db.$queryRaw<{ category: string }[]>(Prisma.sql`SELECT DISTINCT category FROM ${this.table('dishes')} ORDER BY category ASC`)).map(row => row.category) };
    }
    async find(resource: Resource, id: number): Promise<Entity | null> {
        const row = resource === 'dishes'
            ? await this.db.dish.findUnique({ where: { id }, include: relations })
            : resource === 'chefs'
                ? await this.db.chef.findUnique({ where: { id }, include: dishLinks })
                : await this.db.ingredient.findUnique({ where: { id }, include: dishLinks });
        return row ? normalize(row) : null;
    }
    private async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        for (let attempt = 0;; attempt++) {
            try {
                return await this.db.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 });
            }
            catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    if (error.code === 'P2034' && attempt < 3)
                        continue;
                    if (error.code === 'P2025')
                        throw new NotFoundError();
                    if (error.code === 'P2003')
                        throw new InputError({ form: 'Dữ liệu liên kết vừa thay đổi. Vui lòng kiểm tra và thử lại.' });
                }
                throw error;
            }
        }
    }
    private async dishData(tx: Prisma.TransactionClient, input: EntityInput) {
        const [chefs, ingredients] = await Promise.all([
            tx.chef.count({ where: { id: { in: input.chefIds } } }),
            tx.ingredient.count({ where: { id: { in: input.ingredientIds } } }),
        ]);
        const errors: {
            chefIds?: string;
            ingredientIds?: string;
        } = {};
        if (chefs !== input.chefIds.length)
            errors.chefIds = 'Một đầu bếp đã bị xóa hoặc không tồn tại. Vui lòng chọn lại.';
        if (ingredients !== input.ingredientIds.length)
            errors.ingredientIds = 'Một nguyên liệu đã bị xóa hoặc không tồn tại. Vui lòng chọn lại.';
        if (Object.keys(errors).length)
            throw new InputError(errors);
        return {
            name: input.name, description: input.description, price: input.price,
            category: input.category, available: input.available,
        };
    }
    async create(resource: Resource, input: EntityInput) {
        return this.transaction(async (tx) => {
            if (resource === 'dishes') {
                const data = await this.dishData(tx, input);
                return normalize(await tx.dish.create({ data: {
                        ...data, chefs: { connect: input.chefIds.map(id => ({ id })) },
                        ingredients: { connect: input.ingredientIds.map(id => ({ id })) },
                    }, include: relations }));
            }
            if (resource === 'chefs')
                return normalize(await tx.chef.create({ data: { name: input.name, specialty: input.specialty }, include: dishLinks }));
            return normalize(await tx.ingredient.create({ data: { name: input.name, unit: input.unit }, include: dishLinks }));
        });
    }
    async update(resource: Resource, id: number, patch: Partial<EntityInput>) {
        return this.transaction(async (tx) => {
            const current = resource === 'dishes' ? await tx.dish.findUnique({ where: { id }, include: relations }) : resource === 'chefs' ? await tx.chef.findUnique({ where: { id } }) : await tx.ingredient.findUnique({ where: { id } });
            if (!current)
                throw new NotFoundError();
            if (resource === 'dishes') {
                const dish = current as Prisma.DishGetPayload<{
                    include: typeof relations;
                }>;
                const input = { ...dish, price: String(dish.price), specialty: '', unit: '', chefIds: dish.chefs.map(c => c.id), ingredientIds: dish.ingredients.map(i => i.id), ...patch };
                const all = await this.dishData(tx, input);
                const data = Object.fromEntries(Object.entries(all).filter(([key]) => key in patch));
                return normalize(await tx.dish.update({ where: { id }, data: { ...data, ...(patch.chefIds ? { chefs: { set: patch.chefIds.map(id => ({ id })) } } : {}), ...(patch.ingredientIds ? { ingredients: { set: patch.ingredientIds.map(id => ({ id })) } } : {}) }, include: relations }));
            }
            const data = { ...(patch.name !== undefined ? { name: patch.name } : {}) };
            if (resource === 'chefs')
                return normalize(await tx.chef.update({ where: { id }, data: { ...data, ...(patch.specialty !== undefined ? { specialty: patch.specialty } : {}) }, include: dishLinks }));
            return normalize(await tx.ingredient.update({ where: { id }, data: { ...data, ...(patch.unit !== undefined ? { unit: patch.unit } : {}) }, include: dishLinks }));
        });
    }
    async delete(resource: Resource, id: number) {
        await this.transaction(async (tx) => {
            if (resource === 'ingredients') {
                const ingredient = await tx.ingredient.findUnique({ where: { id }, include: dishLinks });
                if (!ingredient)
                    throw new NotFoundError();
                if (ingredient.dishes.length)
                    throw new IngredientInUseError(ingredient.dishes);
                await tx.ingredient.delete({ where: { id } });
            }
            else if (resource === 'chefs') {
                await tx.chef.delete({ where: { id } });
            }
            else {
                await tx.dish.delete({ where: { id } });
            }
        });
    }
}
