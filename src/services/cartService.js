import { currentUserId, nextId, store } from '../data/store.js';
import { getMedicineDetail } from './medicineService.js';
import { HttpError } from '../utils/apiResponse.js';

function selectedItems() {
  return store.cartItems.filter((item) => item.userId === currentUserId && item.selected);
}

function toCartVO(item) {
  const medicine = getMedicineDetail(item.medicineId);
  return {
    cartItemId: item.cartItemId,
    medicineId: item.medicineId,
    name: medicine.name,
    specification: medicine.specification,
    prescriptionType: medicine.prescriptionType,
    price: medicine.price,
    stockQuantity: medicine.stockQuantity,
    stockStatus: medicine.stockStatus,
    quantity: item.quantity,
    selected: item.selected,
    subtotal: Number((medicine.price * item.quantity).toFixed(2)),
    auditRequired: medicine.prescriptionType === 'PRESCRIPTION'
  };
}

export function calculateSummary(items = selectedItems()) {
  const productAmount = items.reduce((sum, item) => {
    const medicine = getMedicineDetail(item.medicineId);
    return sum + medicine.price * item.quantity;
  }, 0);
  const discountAmount = productAmount >= 80 ? 8 : 0;
  return {
    selectedCount: items.reduce((sum, item) => sum + item.quantity, 0),
    productAmount: Number(productAmount.toFixed(2)),
    discountAmount,
    payableAmount: Number(Math.max(productAmount - discountAmount, 0).toFixed(2))
  };
}

export function listCart() {
  const items = store.cartItems.filter((item) => item.userId === currentUserId);
  return {
    items: items.map(toCartVO),
    summary: calculateSummary(items.filter((item) => item.selected))
  };
}

export function addToCart(payload) {
  const medicine = getMedicineDetail(payload.medicineId);
  const quantity = Math.max(Number(payload.quantity || 1), 1);
  if (medicine.status !== 'ON_SALE' || medicine.stockQuantity <= 0) {
    throw new HttpError('该药品当前不可购买');
  }
  if (quantity > medicine.stockQuantity) throw new HttpError('加入数量超过可售库存');

  let item = store.cartItems.find(
    (cartItem) => cartItem.userId === currentUserId && cartItem.medicineId === medicine.medicineId
  );
  if (item) {
    item.quantity = Math.min(item.quantity + quantity, medicine.stockQuantity);
    item.selected = true;
  } else {
    item = {
      cartItemId: nextId(store.cartItems, 'cartItemId', 501),
      userId: currentUserId,
      medicineId: medicine.medicineId,
      quantity,
      selected: true,
      addedAt: new Date().toISOString()
    };
    store.cartItems.push(item);
  }
  return toCartVO(item);
}

export function updateCartItem(cartItemId, payload) {
  const item = store.cartItems.find((cartItem) => cartItem.cartItemId === Number(cartItemId));
  if (!item) throw new HttpError('购物车商品不存在', 404);
  const medicine = getMedicineDetail(item.medicineId);
  if (payload.quantity !== undefined) {
    const quantity = Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError('数量必须为正整数');
    if (quantity > medicine.stockQuantity) throw new HttpError('数量超过可售库存');
    item.quantity = quantity;
  }
  if (payload.selected !== undefined) item.selected = Boolean(payload.selected);
  return { item: toCartVO(item), summary: listCart().summary };
}

export function deleteCartItem(cartItemId) {
  const index = store.cartItems.findIndex((item) => item.cartItemId === Number(cartItemId));
  if (index < 0) throw new HttpError('购物车商品不存在', 404);
  store.cartItems.splice(index, 1);
  return listCart();
}

export function getCartItemsByIds(cartItemIds) {
  const ids = cartItemIds.map(Number);
  const items = store.cartItems.filter((item) => ids.includes(item.cartItemId));
  if (items.length === 0) throw new HttpError('请选择要结算的购物车商品');
  return items;
}
