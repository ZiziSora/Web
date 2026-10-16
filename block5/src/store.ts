import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import {
  IngredientInUseError, InputError, NotFoundError,
  type Entity, type EntityInput, type Resource, type RestaurantStore,
} from './domain.js';

const relations = { chefs: { orderBy: { name: 'asc' as const } }, ingredients: { orderBy: { name: 'asc' as const } } };
const dishLinks = { dishes: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } } };
const normalize = (row: Record<string, unknown>): Entity => ({
  ...row, ...(row.price !== undefined ? { price: String(row.price) } : {}),
}) as unknown as Entity;

export class PrismaRestaurantStore implements RestaurantStore {
  constructor(private db: PrismaClient) {}

  async list(resource: Resource, q = ''): Promise<Entity[]> {
    if (resource === 'dishes') {
      // Escape LIKE wildcards so a search term is treated as literal text.
      const escaped = q.replace(/[\\%_]/g, '\\$&');
      return (await this.db.dish.findMany({
        where: q ? { name: { contains: escaped, mode: 'insensitive' } } : {},
        include: relations, orderBy: { id: 'asc' },
      })).map(normalize);
    }
    if (resource === 'chefs') return (await this.db.chef.findMany({ include: dishLinks, orderBy: { id: 'asc' } })).map(normalize);
    return (await this.db.ingredient.findMany({ include: dishLinks, orderBy: { id: 'asc' } })).map(normalize);
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
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && attempt < 3) continue;
          if (error.code === 'P2025') throw new NotFoundError();
          if (error.code === 'P2003') throw new InputError({ form: 'Dữ liệu liên kết vừa thay đổi. Vui lòng kiểm tra và thử lại.' });
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
    const errors: { chefIds?: string; ingredientIds?: string } = {};
    if (chefs !== input.chefIds.length) errors.chefIds = 'Một đầu bếp đã bị xóa hoặc không tồn tại. Vui lòng chọn lại.';
    if (ingredients !== input.ingredientIds.length) errors.ingredientIds = 'Một nguyên liệu đã bị xóa hoặc không tồn tại. Vui lòng chọn lại.';
    if (Object.keys(errors).length) throw new InputError(errors);
    return {
      name: input.name, description: input.description, price: input.price,
      category: input.category, available: input.available,
    };
  }

  async create(resource: Resource, input: EntityInput) {
    return this.transaction(async tx => {
      if (resource === 'dishes') {
        const data = await this.dishData(tx, input);
        return normalize(await tx.dish.create({ data: {
          ...data, chefs: { connect: input.chefIds.map(id => ({ id })) },
          ingredients: { connect: input.ingredientIds.map(id => ({ id })) },
        }, include: relations }));
      }
      if (resource === 'chefs') return normalize(await tx.chef.create({ data: { name: input.name, specialty: input.specialty }, include: dishLinks }));
      return normalize(await tx.ingredient.create({ data: { name: input.name, unit: input.unit }, include: dishLinks }));
    });
  }

  async update(resource: Resource, id: number, input: EntityInput) {
    return this.transaction(async tx => {
      if (resource === 'dishes') {
        const data = await this.dishData(tx, input);
        return normalize(await tx.dish.update({ where: { id }, data: {
          ...data, chefs: { set: input.chefIds.map(id => ({ id })) },
          ingredients: { set: input.ingredientIds.map(id => ({ id })) },
        }, include: relations }));
      }
      if (resource === 'chefs') return normalize(await tx.chef.update({ where: { id }, data: { name: input.name, specialty: input.specialty }, include: dishLinks }));
      return normalize(await tx.ingredient.update({ where: { id }, data: { name: input.name, unit: input.unit }, include: dishLinks }));
    });
  }

  async delete(resource: Resource, id: number) {
    await this.transaction(async tx => {
      if (resource === 'ingredients') {
        const ingredient = await tx.ingredient.findUnique({ where: { id }, include: dishLinks });
        if (!ingredient) throw new NotFoundError();
        if (ingredient.dishes.length) throw new IngredientInUseError(ingredient.dishes);
        await tx.ingredient.delete({ where: { id } });
      } else if (resource === 'chefs') {
        await tx.chef.delete({ where: { id } });
      } else {
        await tx.dish.delete({ where: { id } });
      }
    });
  }
}
