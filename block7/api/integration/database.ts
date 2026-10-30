import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { createDatabase } from '../src/db.js';
import { PrismaRestaurantStore } from '../src/store.js';
import { seedRestaurant } from '../prisma/seed.js';
import { setupSearch } from '../src/search-setup.js';
import { parseListQuery } from '../src/list-query.js';
import { jsonInput, IngredientInUseError, type EntityInput } from '../src/domain.js';
test('PostgreSQL: CRUD, seed, server paging, search và cursor trong schema cô lập', {timeout: 600000}, async () => {
    if (!process.env.DATABASE_URL)
        throw new Error('Cần DATABASE_URL để kiểm thử DB.');
    const schema = 'block7_test_' + randomUUID().replaceAll('-', '');
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('schema', schema);
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    const db = createDatabase(url.toString());
    let created = false;
    try {
        await pool.query(`CREATE SCHEMA "${schema}"`);
        created = true;
        const push = spawnSync('npm', ['exec', '--', 'prisma', 'db', 'push'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', timeout: 90000 });
        assert.equal(push.status, 0, 'Không thể tạo schema kiểm thử.');
        for (let i = 0; i < 2; i++) await seedRestaurant(db, schema);
        assert.equal(await db.dish.count(), 12);
        assert.equal(await db.chef.count(), 4);
        assert.equal(await db.ingredient.count(), 12);
        const setupClient = await pool.connect();
        try { await setupSearch(setupClient, schema); await setupSearch(setupClient, schema); }
        finally { setupClient.release(); }
        const store = new PrismaRestaurantStore(db, schema);
        const seeded = await store.list('dishes', parseListQuery('dishes', {q:'BO LUC LAC'}));
        assert.equal(seeded.items[0].name, 'Bò lúc lắc');
        assert.equal(seeded.meta.total, 1);
        assert.ok(!('searchName' in seeded.items[0]));
        const chef = await store.create('chefs', jsonInput('chefs', { name: 'Test', specialty: 'Âu' }) as EntityInput);
        const ingredient = await store.create('ingredients', jsonInput('ingredients', { name: 'Test', unit: 'kg' }) as EntityInput);
        const input = jsonInput('dishes', { name: 'Test', description: 'test', price: '123456.78', category: 'test', chefIds: [chef.id], ingredientIds: [ingredient.id] }) as EntityInput;
        const dish = await store.create('dishes', input);
        assert.equal(dish.price, '123456.78');
        assert.equal(dish.chefs?.[0].specialty, 'Âu');
        await assert.rejects(store.delete('ingredients', ingredient.id), IngredientInUseError);
        const updated = await store.update('dishes', dish.id, { name: 'Updated' });
        assert.equal(updated.price, dish.price);
        assert.equal(updated.ingredients?.length, 1);
        await store.delete('chefs', chef.id);
        assert.ok(await store.find('dishes', dish.id));
        await store.update('dishes', dish.id, { ingredientIds: [] });
        await store.delete('ingredients', ingredient.id);
        for (let i = 0; i < 3; i++) {
            const ing = await store.create('ingredients', { ...input, name: 'Race', unit: 'kg' });
            const results = await Promise.allSettled([store.create('dishes', { ...input, chefIds: [], ingredientIds: [ing.id] }), store.delete('ingredients', ing.id)]);
            assert.ok(results.some(r => r.status === 'rejected'));
        }
        // All destructive fixture operations below are limited to this random schema.
        await db.dish.deleteMany();
        await db.chef.deleteMany();
        await db.ingredient.deleteMany();
        const list = (raw: Record<string, string>) => store.list('dishes', parseListQuery('dishes', raw));
        for (const count of [0, 1, 6, 7, 13]) {
            await db.dish.deleteMany();
            await db.dish.createMany({data:Array.from({length:count},(_,i)=>({name:'Món thử '+String(i+1).padStart(2,'0'),description:'Bí đỏ thơm',price:String(i*100),category:i%2?'B':'A',available:i%2===0}))});
            const ids: number[] = [];
            for (let page=1;page<=Math.max(1,Math.ceil(count/6));page++) {
                const result=await list({page:String(page)});
                assert.equal(result.meta.total,count);
                assert.ok(result.items.length<=6);
                ids.push(...result.items.map(row=>row.id));
            }
            assert.equal(ids.length,count);assert.equal(new Set(ids).size,count);
            const clamped=await list({page:'999'});assert.equal(clamped.meta.page,Math.max(1,Math.ceil(count/6)));
        }
        const and=await list({mode:'advanced',q:'MON THU',category:'A',available:'true',minPrice:'200',maxPrice:'800',sort:'price-desc'});
        assert.deepEqual(and.items.map(row=>Number(row.price)),[800,600,400,200]);
        const text=await list({mode:'fulltext',q:'BI DO',page:'2'});
        assert.equal(text.meta.total,13);assert.equal(text.items.length,6);
        const text1=await list({mode:'fulltext',q:'bi do'});
        assert.ok(text1.items.at(-1)!.id<text.items[0].id,'equal ranks use id');
        const fuzzy=await list({mode:'fuzzy',q:'mon thu 01'});
        assert.equal(fuzzy.items[0].name,'Món thử 01');
        const fallback=await list({mode:'fulltext',fallback:'fuzzy',q:'mon thuu 01',category:'A',available:'true'});
        assert.equal(fallback.meta.effectiveMode,'fuzzy');assert.ok(fallback.items.length>0);
        assert.ok(fallback.items.every(row=>row.category==='A'&&row.available));
        const point=await list({mode:'fuzzy',q:'mon thu 01'});
        const client=await pool.connect();
        try {
            const ns='"'+schema+'"';
            const ext=await client.query("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'");
            const trgm='"'+ext.rows[0].nspname+'"';
            const expected=await client.query(`SELECT id FROM ${ns}."Dish" WHERE ${trgm}.similarity("searchName",${ns}.search_normalize($1)) >= 0.3::real ORDER BY ${trgm}.similarity("searchName",${ns}.search_normalize($1)) DESC,id ASC LIMIT 6`,['mon thu 01']);
            assert.deepEqual(point.items.map(row=>row.id),expected.rows.map(row=>row.id));
            const indexes=await client.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1',[schema]);
            assert.ok(indexes.rows.some(row=>row.indexname==='Dish_search_vector'));
            assert.ok(indexes.rows.some(row=>row.indexname==='Dish_search_name_trgm'));
            const explain=await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM ${ns}."Dish" WHERE "searchVector" @@ websearch_to_tsquery('simple',${ns}.search_normalize($1)) ORDER BY id LIMIT 6`,['bi do']);
            assert.equal(explain.rows[0]['QUERY PLAN'][0].Plan['Actual Rows'],6);
        } finally {client.release();}
        const boundary=await db.dish.create({data:{name:'ab cdefgh',description:'Boundary',price:'1',category:'A'}});
        assert.ok((await list({mode:'fuzzy',q:'ab'})).items.some(row=>row.id===boundary.id),'inclusive similarity 0.3');
        await db.dish.delete({where:{id:boundary.id}});
        const twins=await Promise.all([0,1].map(()=>db.dish.create({data:{name:'Bánh nấm',description:'Tie',price:'1',category:'A'}})));
        const tied=await list({mode:'fuzzy',q:'banh nam'});
        assert.deepEqual(tied.items.map(row=>row.id),twins.map(row=>row.id).sort((a,b)=>a-b));
        await db.dish.deleteMany({where:{id:{in:twins.map(row=>row.id)}}});
        const changed=text1.items[0];
        await store.update('dishes',changed.id,{name:'Đậu hũ đặc biệt',description:'Rong biển'});
        assert.equal((await list({q:'dau hu'})).items[0].id,changed.id);
        assert.equal((await list({mode:'fulltext',q:'rong bien'})).items[0].id,changed.id);
        await store.update('dishes',changed.id,{name:'100%_ngon'});
        assert.equal((await list({q:'%_'})).meta.total,1);
        assert.equal((await list({q:"' OR 1=1 --"})).meta.total,0);
        for (const resource of ['chefs','ingredients'] as const) {
            await (resource==='chefs'?db.chef.createMany({data:Array.from({length:13},(_,i)=>({name:'Đầu '+i,specialty:'Việt'}))}):db.ingredient.createMany({data:Array.from({length:13},(_,i)=>({name:'Đậu '+i,unit:'kg'}))}));
            let after=0;const ids:number[]=[];
            do {const result=await store.options(resource,{q:'dau',after,limit:6});assert.ok(result.items.length<=6);ids.push(...result.items.map(row=>row.id));after=result.nextCursor??0;} while(after);
            assert.equal(ids.length,13);assert.equal(new Set(ids).size,13);
        }
        assert.deepEqual((await store.facets()).categories,['A','B']);
        console.log('PostgreSQL PASS: setup idempotent/backfill, 5 page boundaries, AND filters, unaccent, real FTS/ranking, pg_trgm/fallback, wildcard escaping, triggers, cursors and EXPLAIN.');

    }
    finally {
        await db.$disconnect();
        if (created)
            await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        await pool.end();
    }
});
