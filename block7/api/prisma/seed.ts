import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createDatabase } from '../src/db.js';

export const sampleChefs = [
  { name: 'Nguyễn Minh An', specialty: 'Ẩm thực Việt & món nướng' },
  { name: 'Trần Thảo Linh', specialty: 'Ẩm thực Âu & pasta' },
  { name: 'Lê Hoàng Nam', specialty: 'Hải sản & hương vị châu Á' },
  { name: 'Phạm Ngọc Mai', specialty: 'Món chay & món khai vị' },
];
export const sampleIngredients = [
  { name: 'Thịt bò', unit: 'kg' }, { name: 'Thịt gà', unit: 'kg' },
  { name: 'Tôm', unit: 'kg' }, { name: 'Thịt heo', unit: 'kg' },
  { name: 'Gạo', unit: 'kg' }, { name: 'Trứng gà', unit: 'quả' },
  { name: 'Nấm', unit: 'gram' }, { name: 'Hành tây', unit: 'kg' },
  { name: 'Cà chua', unit: 'kg' }, { name: 'Mì pasta', unit: 'gram' },
  { name: 'Phô mai', unit: 'gram' }, { name: 'Bơ', unit: 'gram' },
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

export async function seedRestaurant(db: PrismaClient, schema = 'public') {
  await db.$transaction(async tx => {
    // Serialize seed runs without touching any existing business records.
    if (schema === 'public') await tx.$queryRaw`SELECT pg_advisory_xact_lock(9050101)::text`;
    else await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${schema}), 9050101)::text`;
    const chefs: { id: number }[] = [];
    for (const data of sampleChefs) chefs.push(await tx.chef.findFirst({ where: { name: data.name } }) ?? await tx.chef.create({ data }));
    const ingredients: { id: number }[] = [];
    for (const data of sampleIngredients) ingredients.push(await tx.ingredient.findFirst({ where: { name: data.name } }) ?? await tx.ingredient.create({ data }));
    for (const { chefs: chefIndexes, ingredients: ingredientIndexes, ...data } of sampleDishes) {
      if (await tx.dish.findFirst({ where: { name: data.name } })) continue;
      await tx.dish.create({ data: {
        ...data, chefs: { connect: chefIndexes.map(i => ({ id: chefs[i].id })) },
        ingredients: { connect: ingredientIndexes.map(i => ({ id: ingredients[i].id })) },
      } });
    }
  }, { timeout: 120000, maxWait: 30000 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const db = createDatabase();
try {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? 'public';
  await seedRestaurant(db, schema);
  console.log('Seed hoàn tất: 12 món, 4 đầu bếp, 12 nguyên liệu mẫu. Không ghi đè bản ghi đã có.');
} catch {
  console.error('Không thể seed dữ liệu. Kiểm tra kết nối và chạy db:push trước.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
}
