import { IngredientInUseError, InputError, NotFoundError, type Entity, type EntityInput, type Resource, type RestaurantStore } from '../src/domain.js';

/** HTTP tests use an isolated store; database tests verify the real Prisma implementation. */
export class MemoryStore implements RestaurantStore {
  rows: Record<Resource, Entity[]> = {
    dishes: [{ id: 1, name: 'Bò lúc lắc', description: 'Bò mềm, hành giòn.', price: '165000', category: 'Món Việt', available: true, chefs: [{ id: 1, name: 'An' }], ingredients: [{ id: 1, name: 'Hành tây', unit: 'kg' }] }],
    chefs: [{ id: 1, name: 'An', specialty: 'Món Việt' }],
    ingredients: [{ id: 1, name: 'Hành tây', unit: 'kg' }],
  };
  async list(resource: Resource, q = '') {
    return this.rows[resource].filter(e => e.name.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi'))).map(e => this.hydrate(resource, e));
  }
  private hydrate(resource: Resource, row: Entity): Entity {
    const entity = structuredClone(row);
    if (resource !== 'dishes') entity.dishes = this.rows.dishes.filter(d => (resource === 'chefs' ? d.chefs : d.ingredients)?.some(r => r.id === row.id)).map(d => ({ id: d.id, name: d.name }));
    return entity;
  }
  async find(resource: Resource, id: number) {
    const row = this.rows[resource].find(e => e.id === id);
    return row ? this.hydrate(resource, row) : null;
  }
  private data(resource: Resource, input: EntityInput): Omit<Entity, 'id'> {
    if (resource === 'chefs') return { name: input.name, specialty: input.specialty };
    if (resource === 'ingredients') return { name: input.name, unit: input.unit };
    if (input.chefIds.some(id => !this.rows.chefs.some(c => c.id === id))) throw new InputError({ chefIds: 'Đầu bếp không tồn tại.' });
    if (input.ingredientIds.some(id => !this.rows.ingredients.some(c => c.id === id))) throw new InputError({ ingredientIds: 'Nguyên liệu không tồn tại.' });
    return {
      name: input.name, description: input.description, price: input.price, category: input.category, available: input.available,
      chefs: this.rows.chefs.filter(c => input.chefIds.includes(c.id)).map(c => ({ id: c.id, name: c.name })),
      ingredients: this.rows.ingredients.filter(c => input.ingredientIds.includes(c.id)).map(c => ({ id: c.id, name: c.name, unit: c.unit })),
    };
  }
  async create(resource: Resource, input: EntityInput) {
    const row = { ...this.data(resource, input), id: Math.max(0, ...this.rows[resource].map(e => e.id)) + 1 };
    this.rows[resource].push(row);
    return this.hydrate(resource, row);
  }
  async update(resource: Resource, id: number, input: EntityInput) {
    const index = this.rows[resource].findIndex(e => e.id === id);
    if (index < 0) throw new NotFoundError();
    const row = { id, ...this.data(resource, input) };
    this.rows[resource][index] = row;
    return this.hydrate(resource, row);
  }
  async delete(resource: Resource, id: number) {
    const entity = await this.find(resource, id);
    if (!entity) throw new NotFoundError();
    if (resource === 'ingredients' && entity.dishes?.length) throw new IngredientInUseError(entity.dishes);
    this.rows[resource] = this.rows[resource].filter(e => e.id !== id);
    if (resource === 'chefs') this.rows.dishes.forEach(d => { d.chefs = d.chefs?.filter(c => c.id !== id); });
  }
}
