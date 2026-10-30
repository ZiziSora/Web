import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';
import { quoteIdentifier } from '../src/search-setup.js';
import { createDatabase } from '../src/db.js';

export const sampleChefs = [
  { name: 'Nguyễn Minh An', specialty: 'Ẩm thực Việt & món nướng' },
  { name: 'Trần Thảo Linh', specialty: 'Ẩm thực Âu & pasta' },
  { name: 'Lê Hoàng Nam', specialty: 'Hải sản & hương vị châu Á' },
  { name: 'Phạm Ngọc Mai', specialty: 'Món chay & món khai vị' },
  { name: 'Đặng Quốc Bảo', specialty: 'Món Việt & các món kho' },
  { name: 'Võ Thanh Hà', specialty: 'Ẩm thực miền Trung' },
  { name: 'Bùi Đức Huy', specialty: 'Món nướng & sốt tiêu' },
  { name: 'Đỗ Thu Hương', specialty: 'Salad & món ăn thanh nhẹ' },
  { name: 'Hoàng Gia Khánh', specialty: 'Hải sản & món hấp' },
  { name: 'Phan Bảo Ngọc', specialty: 'Món chay & rau củ' },
  { name: 'Vũ Minh Quân', specialty: 'Ẩm thực Ý & pasta' },
  { name: 'Trịnh Hải Yến', specialty: 'Súp & món khai vị' },
  { name: 'Ngô Anh Dũng', specialty: 'Ẩm thực miền Bắc' },
  { name: 'Dương Thùy Chi', specialty: 'Món cuốn & nước chấm' },
  { name: 'Lý Thành Đạt', specialty: 'Cơm & các món chiên' },
  { name: 'Mai Phương Linh', specialty: 'Ẩm thực Âu & sốt kem' },
  { name: 'Tạ Hoàng Long', specialty: 'Thịt bò & món áp chảo' },
  { name: 'Đinh Ngọc Ánh', specialty: 'Ẩm thực miền Nam' },
  { name: 'Hồ Tuấn Kiệt', specialty: 'Món gà & thảo mộc' },
  { name: 'Cao Diệu Trang', specialty: 'Món gia đình & thực đơn theo mùa' },
];
export const sampleIngredients = [
  { name: 'Thịt bò', unit: 'kg' }, { name: 'Thịt gà', unit: 'kg' },
  { name: 'Tôm', unit: 'kg' }, { name: 'Thịt heo', unit: 'kg' },
  { name: 'Gạo', unit: 'kg' }, { name: 'Trứng gà', unit: 'quả' },
  { name: 'Nấm', unit: 'gram' }, { name: 'Hành tây', unit: 'kg' },
  { name: 'Cà chua', unit: 'kg' }, { name: 'Mì pasta', unit: 'gram' },
  { name: 'Phô mai', unit: 'gram' }, { name: 'Bơ', unit: 'gram' },
  { name: 'Tỏi', unit: 'gram' }, { name: 'Gừng', unit: 'gram' },
  { name: 'Sả', unit: 'cây' }, { name: 'Chanh vàng', unit: 'quả' },
  { name: 'Tiêu xanh', unit: 'gram' }, { name: 'Mè rang', unit: 'gram' },
  { name: 'Húng quế', unit: 'gram' }, { name: 'Ớt', unit: 'quả' },
];
const sampleDishes = [
  { name: 'Bò lúc lắc', description: 'Thịt bò áp chảo vừa chín tới, quyện sốt đậm đà cùng hành tây giòn ngọt. Một hương vị thân quen, luôn đáng để quay lại.', price: '165000', category: 'Hương vị Việt', available: true, chefs: [0, 2], ingredients: [0, 7, 8, 11] },
  { name: 'Pasta nấm kem', description: 'Sợi pasta mềm vừa, nấm thơm và sốt kem phô mai mượt mà. Dịu dàng, ấm áp như một buổi chiều chẳng vội.', price: '145000', category: 'Từ căn bếp Âu', available: true, chefs: [1, 3], ingredients: [6, 9, 10, 11] },
  { name: 'Cơm gà thảo mộc', description: 'Gà nướng thơm thảo mộc, cơm dẻo nóng hổi và chút sốt nhà làm. Những điều giản dị kết hợp thành một bữa ngon trọn vẹn.', price: '125000', category: 'Hương vị Việt', available: true, chefs: [0, 2], ingredients: [1, 4, 7] },
  { name: 'Tôm áp chảo bơ tỏi', description: 'Tôm tươi áp chảo, áo lớp bơ thơm béo và vị tỏi nhẹ. Một món nhỏ với thật nhiều hương vị, rất hợp để sẻ chia.', price: '185000', category: 'Món sẻ chia', available: true, chefs: [1, 2], ingredients: [2, 11] },
  { name: 'Cơm chiên nhà Table', description: 'Hạt cơm tơi vàng, tôm ngọt và trứng béo, được đảo nhanh tay trên lửa lớn. Món quen của căn bếp, dành cho mọi chiếc bàn.', price: '115000', category: 'Hương vị Việt', available: true, chefs: [0, 2, 3], ingredients: [2, 4, 5, 7] },
  { name: 'Gà sốt nấm', description: 'Gà áp chảo vàng nhẹ, dùng cùng sốt nấm thơm và mượt. Sự kết hợp ấm áp từ những nguyên liệu được chọn lựa mỗi ngày.', price: '155000', category: 'Từ căn bếp Âu', available: false, chefs: [0, 1], ingredients: [1, 6, 11] },
  { name: 'Salad cà chua phô mai', description: 'Cà chua mọng ngọt bên phô mai dịu béo, thêm chút hương vị tươi mới. Một khởi đầu nhẹ nhàng cho câu chuyện quanh bàn ăn.', price: '85000', category: 'Khởi đầu nhẹ nhàng', available: true, chefs: [1, 3], ingredients: [8, 10] },
  { name: 'Pasta bò cà chua', description: 'Sốt bò cà chua được nấu chậm để giữ trọn vị ngọt tự nhiên. Dùng cùng pasta và phô mai, đậm đà theo cách thật dễ yêu.', price: '155000', category: 'Từ căn bếp Âu', available: true, chefs: [1], ingredients: [0, 7, 8, 9, 10] },
  { name: 'Cơm nấm chay', description: 'Nấm xào thơm, cơm dẻo và vị ngọt thanh từ rau củ. Một lựa chọn nhẹ bụng, đầy đủ niềm vui cho bữa ăn thường ngày.', price: '95000', category: 'Vườn xanh', available: true, chefs: [0, 3], ingredients: [4, 6, 7] },
  { name: 'Heo nướng hành tây', description: 'Thịt heo ướp theo công thức nhà, nướng xém cạnh cùng hành tây. Thơm nồng, đậm vị và ngon hơn khi ăn cùng cơm nóng.', price: '135000', category: 'Hương vị Việt', available: true, chefs: [0, 2], ingredients: [3, 7, 4] },
  { name: 'Trứng cuộn phô mai', description: 'Lớp trứng mềm ôm lấy phô mai tan chảy, giản dị mà đủ khiến bạn mỉm cười. Một đĩa nhỏ để bắt đầu bữa ăn thật vui.', price: '75000', category: 'Món sẻ chia', available: true, chefs: [1, 3], ingredients: [5, 10, 11] },
  { name: 'Súp nấm ấm', description: 'Nấm được nấu chậm, xay mịn cùng chút bơ béo nhẹ. Một bát súp ấm là lời chào thân tình từ căn bếp của chúng tôi.', price: '65000', category: 'Khởi đầu nhẹ nhàng', available: false, chefs: [1, 3], ingredients: [6, 7, 11] },
];

export const SEED_DISH_COUNT = 1000;

/** Stable, synthetic menu variants for paging/search demonstrations. */
export function buildSeedDishes() {
  const flavors = ['tiêu xanh', 'tỏi thơm', 'gừng ấm', 'sả chanh', 'mè rang', 'húng quế', 'ớt dịu', 'chanh vàng', 'thảo mộc', 'vị truyền thống'];
  const portions = ['phần nhỏ', 'phần vừa', 'phần lớn', 'phần đôi', 'phần gia đình', 'bữa trưa', 'bữa tối', 'bữa nhẹ', 'tiệc sẻ chia'];
  return [
    ...sampleDishes,
    ...Array.from({ length: SEED_DISH_COUNT - sampleDishes.length }, (_, index) => {
      const base = sampleDishes[index % sampleDishes.length];
      const variant = Math.floor(index / sampleDishes.length);
      const flavor = flavors[variant % flavors.length];
      const portion = portions[Math.floor(variant / flavors.length)];
      return {
        ...base,
        name: `${base.name} · ${flavor} · ${portion}`,
        description: `${base.description} Phiên bản ${flavor}, phục vụ ${portion}. Dữ liệu thực đơn mẫu dùng để khám phá và kiểm thử tìm kiếm.`,
        price: String(Number(base.price) + (variant % 9) * 5000),
        available: index % 7 !== 0,
      };
    }),
  ];
}

export async function seedRestaurant(db: PrismaClient, schema = 'public') {
  const catalog = buildSeedDishes();
  return db.$transaction(async tx => {
    // Same lock as earlier seeds in public; test schemas have independent locks.
    if (schema === 'public') await tx.$queryRaw`SELECT pg_advisory_xact_lock(9050101)::text`;
    else await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${schema}), 9050101)::text`;
    const chefNames = sampleChefs.map(row => row.name);
    const ingredientNames = sampleIngredients.map(row => row.name);
    const existingChefs = await tx.chef.findMany({ select: { name: true } });
    const existingIngredients = await tx.ingredient.findMany({ select: { name: true } });
    // User-created rows count toward the target; never delete them to make room.
    const chefSlots = Math.max(0, sampleChefs.length - existingChefs.length);
    const ingredientSlots = Math.max(0, sampleIngredients.length - existingIngredients.length);
    const createdChefs = await tx.chef.createMany({ data: sampleChefs.filter(row => !existingChefs.some(existing => existing.name === row.name)).slice(0, chefSlots) });
    const createdIngredients = await tx.ingredient.createMany({ data: sampleIngredients.filter(row => !existingIngredients.some(existing => existing.name === row.name)).slice(0, ingredientSlots) });
    const chefs = await tx.chef.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } });
    const ingredients = await tx.ingredient.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } });
    const existing = await tx.dish.findMany({ where: { name: { in: catalog.map(row => row.name) } }, select: { name: true } });
    const names = new Set(existing.map(row => row.name));
    const missing = catalog.filter(row => !names.has(row.name));
    const chefTable = Prisma.raw(quoteIdentifier(schema) + '."_ChefToDish"');
    const ingredientTable = Prisma.raw(quoteIdentifier(schema) + '."_DishToIngredient"');
    // Bulk rows and links keep 1,000 dishes practical over a remote connection.
    for (let start = 0; start < missing.length; start += 200) {
      const batch = missing.slice(start, start + 200);
      const inserted = await tx.dish.createManyAndReturn({
        data: batch.map(({ chefs: _chefs, ingredients: _ingredients, ...data }) => data),
        select: { id: true, name: true },
      });
      const ids = new Map(inserted.map(row => [row.name, row.id]));
      const chefLinks = batch.flatMap(row => [...new Set(row.chefs.map(index => (chefs.find(chef => chef.name === chefNames[index]) ?? chefs[index % chefs.length]).id))].map(id => Prisma.sql`(${id}, ${ids.get(row.name)!})`));
      const ingredientLinks = batch.flatMap(row => [...new Set(row.ingredients.map(index => (ingredients.find(ingredient => ingredient.name === ingredientNames[index]) ?? ingredients[index % ingredients.length]).id))].map(id => Prisma.sql`(${ids.get(row.name)!}, ${id})`));
      if (chefLinks.length) await tx.$executeRaw(Prisma.sql`INSERT INTO ${chefTable} ("A", "B") VALUES ${Prisma.join(chefLinks)} ON CONFLICT DO NOTHING`);
      if (ingredientLinks.length) await tx.$executeRaw(Prisma.sql`INSERT INTO ${ingredientTable} ("A", "B") VALUES ${Prisma.join(ingredientLinks)} ON CONFLICT DO NOTHING`);
    }
    // Existing rows and their user-edited relationships are deliberately preserved.
    return {
      created: missing.length, total: await tx.dish.count(), catalogSize: catalog.length,
      createdChefs: createdChefs.count, createdIngredients: createdIngredients.count,
      totalChefs: await tx.chef.count(), totalIngredients: await tx.ingredient.count(),
    };
  }, { timeout: 120000, maxWait: 30000 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = createDatabase();
  try {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? 'public';
    const result = await seedRestaurant(db, schema);
    console.log(`Seed hoàn tất: thêm ${result.created} món, ${result.createdChefs} đầu bếp, ${result.createdIngredients} nguyên liệu. Database hiện có ${result.total} món, ${result.totalChefs} đầu bếp, ${result.totalIngredients} nguyên liệu. Không ghi đè bản ghi đã có.`);
  } catch {
    console.error('Không thể seed dữ liệu. Kiểm tra kết nối và tạo bảng trước khi chạy seed.');
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
