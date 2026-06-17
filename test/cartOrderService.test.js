import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../src/data/store.js';
import { addToCart, listCart, updateCartItem } from '../src/services/cartService.js';
import { createOrder, payOrder, previewOrder } from '../src/services/orderService.js';

describe('购物车与订单模块 Service 单元测试', () => {
  beforeEach(() => {
    resetStore();
  });

  it('正常情况：OTC 药品加购、预览、下单、模拟支付并扣减库存', () => {
    const cartItem = addToCart({ medicineId: 103, quantity: 2 });
    const preview = previewOrder({ cartItemIds: [cartItem.cartItemId], deliveryType: '同城配送' });

    expect(preview.hasPrescriptionDrug).toBe(false);
    expect(preview.summary.productAmount).toBe(25.8);

    const order = createOrder({
      cartItemIds: [cartItem.cartItemId],
      agreementAccepted: true,
      payMethod: 'WECHAT'
    });
    expect(order.orderStatus).toBe('待支付');
    expect(listCart().items).toHaveLength(0);

    const paid = payOrder({ orderId: order.orderId, payMethod: 'WECHAT' });
    expect(paid.orderStatus).toBe('待配送');
    expect(store.medicines.find((item) => item.medicineId === 103).stockQuantity).toBe(118);
  });

  it('异常情况：缺货药品不可加入购物车', () => {
    expect(() => addToCart({ medicineId: 104, quantity: 1 })).toThrow('该药品当前不可购买');
  });

  it('异常情况：未确认购药须知时禁止创建订单', () => {
    const cartItem = addToCart({ medicineId: 101, quantity: 1 });

    expect(() => createOrder({ cartItemIds: [cartItem.cartItemId], agreementAccepted: false })).toThrow(
      '请先确认购药须知和风险告知'
    );
  });

  it('异常情况：处方药订单进入待审核状态，未审核不得支付', () => {
    const cartItem = addToCart({ medicineId: 105, quantity: 1 });
    const order = createOrder({ cartItemIds: [cartItem.cartItemId], agreementAccepted: true });

    expect(order.orderStatus).toBe('待审核');
    expect(order.hasPrescriptionDrug).toBe(true);
    expect(() => payOrder({ orderId: order.orderId, payMethod: 'WECHAT' })).toThrow('处方药订单须审核通过后才能支付');
  });

  it('边界情况：重复加购同一药品时数量不能超过库存', () => {
    const first = addToCart({ medicineId: 101, quantity: 60 });
    const second = addToCart({ medicineId: 101, quantity: 20 });

    expect(first.cartItemId).toBe(second.cartItemId);
    expect(second.quantity).toBe(68);
  });

  it('边界情况：购物车数量修改必须是正整数且不能超过库存', () => {
    const cartItem = addToCart({ medicineId: 102, quantity: 1 });

    expect(() => updateCartItem(cartItem.cartItemId, { quantity: 0 })).toThrow('数量必须为正整数');
    expect(() => updateCartItem(cartItem.cartItemId, { quantity: 8 })).toThrow('数量超过可售库存');
  });

  it('边界情况：购物车满 80 元时计算优惠金额', () => {
    addToCart({ medicineId: 101, quantity: 5 });
    const cart = listCart();

    expect(cart.summary.productAmount).toBe(94);
    expect(cart.summary.discountAmount).toBe(8);
    expect(cart.summary.payableAmount).toBe(86);
  });
});
