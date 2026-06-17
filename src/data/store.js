export const currentUserId = 1;

function createInitialStore() {
  return {
  users: [
    {
      userId: 1,
      username: 'demo_user',
      nickname: '演示用户',
      phone: '138****6001'
    }
  ],
  addresses: [
    {
      addressId: 1,
      userId: 1,
      receiverName: '张三',
      receiverPhone: '138****6001',
      detailAddress: '上海市浦东新区健康路 88 号',
      isDefault: true
    }
  ],
  categories: [
    { categoryId: 1, categoryName: '感冒发热', status: 'enabled' },
    { categoryId: 2, categoryName: '肠胃用药', status: 'enabled' },
    { categoryId: 3, categoryName: '维生素', status: 'enabled' },
    { categoryId: 4, categoryName: '外用护理', status: 'enabled' }
  ],
  medicines: [
    {
      medicineId: 101,
      categoryId: 1,
      name: '感冒灵颗粒',
      approvalNo: '国药准字Z44021940',
      specification: '10g*9袋',
      manufacturer: '华南制药厂',
      medicineType: 'OTC',
      indication: '用于感冒引起的头痛、发热、鼻塞、咽痛。',
      contraindication: '对本品过敏者禁用，严重肝肾功能不全者慎用。',
      usageDosage: '开水冲服，一次1袋，一日3次。',
      price: 18.8,
      originalPrice: 22.0,
      monthlySales: 1280,
      stockQuantity: 68,
      safetyStock: 10,
      status: 'ON_SALE',
      tags: ['OTC', '热门'],
      imageColor: '#e7f0ff'
    },
    {
      medicineId: 102,
      categoryId: 2,
      name: '蒙脱石散',
      approvalNo: '国药准字H20000690',
      specification: '3g*10袋',
      manufacturer: '康健药业',
      medicineType: 'OTC',
      indication: '用于成人及儿童急、慢性腹泻的辅助治疗。',
      contraindication: '便秘患者慎用，儿童用药请按说明书或咨询药师。',
      usageDosage: '口服，成人一次1袋，一日3次。',
      price: 16.5,
      originalPrice: 19.0,
      monthlySales: 860,
      stockQuantity: 7,
      safetyStock: 12,
      status: 'ON_SALE',
      tags: ['OTC', '低库存'],
      imageColor: '#e8f7ef'
    },
    {
      medicineId: 103,
      categoryId: 3,
      name: '维生素C片',
      approvalNo: '国药准字H31020611',
      specification: '100mg*100片',
      manufacturer: '城市医药',
      medicineType: 'OTC',
      indication: '用于预防坏血病，也可用于各种急慢性传染病的辅助治疗。',
      contraindication: '长期大量服用可引起不良反应，肾结石患者慎用。',
      usageDosage: '口服，成人一次1片，一日3次。',
      price: 12.9,
      originalPrice: 15.0,
      monthlySales: 2100,
      stockQuantity: 120,
      safetyStock: 20,
      status: 'ON_SALE',
      tags: ['OTC', '常备'],
      imageColor: '#fff2d9'
    },
    {
      medicineId: 104,
      categoryId: 4,
      name: '碘伏消毒液',
      approvalNo: '卫消证字2024第081号',
      specification: '100ml',
      manufacturer: '安护医疗',
      medicineType: 'OTC',
      indication: '用于皮肤、黏膜及小面积创口消毒。',
      contraindication: '对碘过敏者禁用，不得口服。',
      usageDosage: '外用，取适量涂擦患处。',
      price: 9.9,
      originalPrice: 12.0,
      monthlySales: 760,
      stockQuantity: 0,
      safetyStock: 15,
      status: 'ON_SALE',
      tags: ['OTC', '缺货'],
      imageColor: '#f5eafa'
    },
    {
      medicineId: 105,
      categoryId: 1,
      name: '阿莫西林胶囊',
      approvalNo: '国药准字H20003263',
      specification: '0.25g*24粒',
      manufacturer: '正规药业',
      medicineType: 'PRESCRIPTION',
      indication: '用于敏感菌所致感染，须凭处方并经药师审核后购买。',
      contraindication: '青霉素过敏者禁用；孕妇、儿童、肝肾功能异常者遵医嘱。',
      usageDosage: '处方药，请严格按医生处方使用。',
      price: 25.6,
      originalPrice: 28.0,
      monthlySales: 430,
      stockQuantity: 35,
      safetyStock: 10,
      status: 'ON_SALE',
      tags: ['处方药', '需审核'],
      imageColor: '#ffe7e4'
    }
  ],
  cartItems: [],
  orders: [],
  orderItems: [],
  consultSessions: [],
  consultMessages: [],
  aiRiskLogs: []
};
}

export const store = createInitialStore();

export function resetStore() {
  const fresh = createInitialStore();
  Object.keys(store).forEach((key) => {
    delete store[key];
  });
  Object.assign(store, fresh);
}

export function nextId(collection, field, start = 1) {
  return collection.reduce((max, item) => Math.max(max, Number(item[field]) || 0), start - 1) + 1;
}
