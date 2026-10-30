import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeedDishes, SEED_DISH_COUNT, sampleChefs, sampleIngredients } from '../prisma/seed.js';
import { jsonInput } from '../src/domain.js';

test('seed catalog contains 1,000 distinct reproducible dishes that satisfy CRUD validation', () => {
  const rows = buildSeedDishes();
  assert.equal(rows.length, 1000);
  assert.equal(rows.length, SEED_DISH_COUNT);
  assert.equal(new Set(rows.map(row => row.name)).size, 1000);
  assert.deepEqual(buildSeedDishes(), rows);
  assert.equal(sampleChefs.length, 20);
  assert.equal(sampleIngredients.length, 20);
  assert.equal(new Set(sampleChefs.map(row => row.name)).size, 20);
  assert.equal(new Set(sampleIngredients.map(row => row.name)).size, 20);
  for (const chef of sampleChefs) assert.doesNotThrow(() => jsonInput('chefs', chef));
  for (const ingredient of sampleIngredients) assert.doesNotThrow(() => jsonInput('ingredients', ingredient));
  assert.ok(new Set(rows.map(row => row.category)).size >= 5);
  assert.ok(rows.some(row => row.available) && rows.some(row => !row.available));
  for (const row of rows) {
    assert.doesNotThrow(() => jsonInput('dishes', { ...row, chefIds: row.chefs.map(i => i + 1), ingredientIds: row.ingredients.map(i => i + 1) }));
    assert.ok(row.chefs.length && row.chefs.every(i => i >= 0 && i < sampleChefs.length));
    assert.ok(row.ingredients.length && row.ingredients.every(i => i >= 0 && i < sampleIngredients.length));
  }
});
