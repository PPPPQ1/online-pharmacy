import { store } from '../data/store.js';
import { HttpError } from '../utils/apiResponse.js';

function stockStatus(medicine) {
  if (medicine.stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (medicine.stockQuantity <= medicine.safetyStock) return 'LOW_STOCK';
  return 'ENOUGH';
}

function toListVO(medicine) {
  const category = store.categories.find((item) => item.categoryId === medicine.categoryId);
  return {
    medicineId: medicine.medicineId,
    name: medicine.name,
    categoryName: category?.categoryName || '',
    approvalNo: medicine.approvalNo,
    specification: medicine.specification,
    manufacturer: medicine.manufacturer,
    prescriptionType: medicine.medicineType,
    price: medicine.price,
    originalPrice: medicine.originalPrice,
    monthlySales: medicine.monthlySales,
    stockQuantity: medicine.stockQuantity,
    stockStatus: stockStatus(medicine),
    status: medicine.status,
    tags: medicine.tags,
    imageColor: medicine.imageColor,
    action: medicine.stockQuantity > 0 && medicine.status === 'ON_SALE' ? '加入购物车' : '不可购买'
  };
}

export function listCategories() {
  return store.categories.filter((item) => item.status === 'enabled');
}

export function homeOverview() {
  return {
    searchPlaceholder: '搜索药品、症状、批准文号或厂家',
    quickEntries: ['药品搜索', '购物车', '订单查询', 'AI智能药师'],
    categories: listCategories(),
    recommendations: store.medicines
      .filter((item) => item.status === 'ON_SALE')
      .sort((a, b) => b.monthlySales - a.monthlySales)
      .slice(0, 4)
      .map(toListVO),
    reminders: [
      '处方药须经人工药师审核后才能支付配送',
      'AI咨询仅供参考，不能替代医生诊断或处方'
    ]
  };
}

export function searchMedicines(query) {
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const categoryId = Number(query.categoryId || 0);
  const prescriptionType = String(query.prescriptionType || '');
  const sort = String(query.sort || 'comprehensive');
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 50);

  let list = store.medicines.filter((item) => item.status === 'ON_SALE');
  if (keyword) {
    list = list.filter((item) =>
      [item.name, item.indication, item.approvalNo, item.manufacturer].some((value) =>
        String(value).toLowerCase().includes(keyword)
      )
    );
  }
  if (categoryId) list = list.filter((item) => item.categoryId === categoryId);
  if (prescriptionType) list = list.filter((item) => item.medicineType === prescriptionType);
  if (sort === 'sales_desc') list.sort((a, b) => b.monthlySales - a.monthlySales);
  if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);

  const total = list.length;
  const start = (page - 1) * pageSize;
  return { total, page, pageSize, list: list.slice(start, start + pageSize).map(toListVO) };
}

export function getMedicineDetail(medicineId) {
  const medicine = store.medicines.find((item) => item.medicineId === Number(medicineId));
  if (!medicine) throw new HttpError('药品不存在', 404);
  return {
    ...toListVO(medicine),
    indication: medicine.indication,
    contraindication: medicine.contraindication,
    usageDosage: medicine.usageDosage,
    safetyTips: buildSafetyTips(medicine)
  };
}

export function buildSafetyTips(medicine) {
  const tips = [
    '请按说明书或医嘱使用，出现不适及时停用并咨询医生或药师。',
    medicine.contraindication
  ];
  if (medicine.medicineType === 'PRESCRIPTION') {
    tips.unshift('该药为处方药，必须上传有效处方并经人工药师审核。');
  }
  if (stockStatus(medicine) === 'LOW_STOCK') {
    tips.push('当前库存较低，请以下单时库存校验为准。');
  }
  return tips;
}
