import test from 'node:test';
import assert from 'node:assert/strict';
import { searchMedicines, getMedicineDetail } from '../src/services/medicineService.js';
import { addToCart, listCart } from '../src/services/cartService.js';
import { createOrder, payOrder } from '../src/services/orderService.js';
import { createSession, sendMessage } from '../src/services/consultService.js';

test('药品查询支持关键词和详情安全提示', () => {
  const result = searchMedicines({ keyword: '感冒', page: 1, pageSize: 10 });
  assert.ok(result.total >= 1);
  const detail = getMedicineDetail(101);
  assert.equal(detail.name, '感冒灵颗粒');
  assert.ok(detail.safetyTips.length > 0);
});

test('购物车下单和模拟支付闭环', () => {
  const cartItem = addToCart({ medicineId: 103, quantity: 2 });
  const cart = listCart();
  assert.ok(cart.summary.payableAmount > 0);
  const order = createOrder({ cartItemIds: [cartItem.cartItemId], agreementAccepted: true, payMethod: 'WECHAT' });
  assert.equal(order.orderStatus, '待支付');
  const paid = payOrder({ orderId: order.orderId, payMethod: 'WECHAT' });
  assert.equal(paid.orderStatus, '待配送');
});

test('智能咨询命中高风险时要求转人工', async () => {
  const session = createSession({ sessionType: '用药咨询' });
  const result = await sendMessage(session.sessionId, { content: '孕妇可以吃阿莫西林吗，有没有过敏风险' });
  assert.equal(result.handoffRequired, true);
  assert.equal(result.riskLevel, '高');
});
