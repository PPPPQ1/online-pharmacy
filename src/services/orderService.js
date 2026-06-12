import { currentUserId, nextId, store } from '../data/store.js';
import { calculateSummary, getCartItemsByIds } from './cartService.js';
import { getMedicineDetail } from './medicineService.js';
import { HttpError } from '../utils/apiResponse.js';

function defaultAddress(addressId) {
  const address = store.addresses.find((item) => item.addressId === Number(addressId))
    || store.addresses.find((item) => item.userId === currentUserId && item.isDefault);
  if (!address) throw new HttpError('请先维护收货地址');
  return address;
}

function buildOrderItems(cartItems) {
  return cartItems.map((item) => {
    const medicine = getMedicineDetail(item.medicineId);
    if (medicine.stockQuantity < item.quantity) throw new HttpError(`${medicine.name} 库存不足`);
    return {
      medicineId: medicine.medicineId,
      medicineName: medicine.name,
      specification: medicine.specification,
      prescriptionType: medicine.prescriptionType,
      price: medicine.price,
      quantity: item.quantity,
      subtotal: Number((medicine.price * item.quantity).toFixed(2)),
      auditRequired: medicine.prescriptionType === 'PRESCRIPTION'
    };
  });
}

export function previewOrder(payload) {
  const cartItems = getCartItemsByIds(payload.cartItemIds || []);
  const items = buildOrderItems(cartItems);
  const address = defaultAddress(payload.addressId);
  const hasPrescriptionDrug = items.some((item) => item.prescriptionType === 'PRESCRIPTION');
  return {
    items,
    address,
    deliveryType: payload.deliveryType || '同城配送',
    summary: calculateSummary(cartItems),
    riskNotice: hasPrescriptionDrug
      ? '订单包含处方药，需上传处方并经人工药师审核后才能支付。'
      : '请确认药品适应症、禁忌和收货信息，模拟支付后订单进入待配送。',
    hasPrescriptionDrug
  };
}

export function createOrder(payload) {
  if (!payload.agreementAccepted) throw new HttpError('请先确认购药须知和风险告知');
  const preview = previewOrder(payload);
  const orderId = nextId(store.orders, 'orderId', 9001);
  const orderNo = `ORD${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(orderId).padStart(4, '0')}`;
  const orderStatus = preview.hasPrescriptionDrug ? '待审核' : '待支付';
  const order = {
    orderId,
    orderNo,
    userId: currentUserId,
    addressId: preview.address.addressId,
    orderStatus,
    deliveryType: preview.deliveryType,
    payMethod: payload.payMethod || 'WECHAT',
    productAmount: preview.summary.productAmount,
    discountAmount: preview.summary.discountAmount,
    payableAmount: preview.summary.payableAmount,
    hasPrescriptionDrug: preview.hasPrescriptionDrug,
    remark: payload.remark || '',
    createdAt: new Date().toISOString()
  };
  store.orders.unshift(order);

  preview.items.forEach((item) => {
    store.orderItems.push({
      orderItemId: nextId(store.orderItems, 'orderItemId', 1),
      orderId,
      ...item
    });
  });

  const ids = new Set((payload.cartItemIds || []).map(Number));
  store.cartItems = store.cartItems.filter((item) => !ids.has(item.cartItemId));
  return {
    orderId,
    orderNo,
    orderStatus,
    payableAmount: order.payableAmount,
    hasPrescriptionDrug: order.hasPrescriptionDrug,
    nextAction: order.hasPrescriptionDrug ? '等待药师审核' : '模拟支付'
  };
}

export function payOrder(payload) {
  const order = store.orders.find((item) => item.orderId === Number(payload.orderId));
  if (!order) throw new HttpError('订单不存在', 404);
  if (order.orderStatus === '待审核') throw new HttpError('处方药订单须审核通过后才能支付');
  if (!['待支付', '已支付'].includes(order.orderStatus)) throw new HttpError('当前订单状态不可支付');
  order.orderStatus = '待配送';
  order.paidAt = new Date().toISOString();
  store.orderItems
    .filter((item) => item.orderId === order.orderId)
    .forEach((item) => {
      const medicine = store.medicines.find((entry) => entry.medicineId === item.medicineId);
      if (medicine) medicine.stockQuantity = Math.max(medicine.stockQuantity - item.quantity, 0);
    });
  return { orderId: order.orderId, orderNo: order.orderNo, payStatus: 'SUCCESS', orderStatus: order.orderStatus };
}

function toOrderVO(order) {
  const items = store.orderItems.filter((item) => item.orderId === order.orderId);
  const address = store.addresses.find((item) => item.addressId === order.addressId);
  return { ...order, items, address };
}

export function listOrders(query) {
  const status = String(query.status || '');
  let list = store.orders.filter((item) => item.userId === currentUserId);
  if (status) list = list.filter((item) => item.orderStatus === status);
  return { total: list.length, list: list.map(toOrderVO) };
}

export function getOrderDetail(orderId) {
  const order = store.orders.find((item) => item.orderId === Number(orderId));
  if (!order) throw new HttpError('订单不存在', 404);
  return toOrderVO(order);
}
