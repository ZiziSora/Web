import { labels,type Resource } from '../api';

export function formConfig(r: Resource) {
  const fields = r === 'dishes' ? ['name', 'description', 'price', 'category', 'available'] : r === 'chefs' ? ['name', 'specialty'] : ['name', 'unit'];
  const titles: Record<string, string> = { name: 'Tên ' + labels[r], description: 'Mô tả món ăn', price: 'Giá (VNĐ)', category: 'Danh mục', available: 'Trạng thái phục vụ', specialty: 'Chuyên môn', unit: 'Đơn vị tính' };
  const placeholders: Record<string, string> = { name: 'Nhập tên ' + labels[r], description: 'Hương vị, cách chế biến và điều làm nên món ăn…', price: 'Ví dụ: 125000', category: 'Ví dụ: Hương vị Việt', specialty: 'Ví dụ: Ẩm thực Việt & món nướng', unit: 'Ví dụ: kg, gram, quả' };
  return {fields,titles,placeholders};
}
