import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../src/data/store.js';
import { getMedicineDetail, searchMedicines } from '../src/services/medicineService.js';
import { HttpError } from '../src/utils/apiResponse.js';

describe('药品查询与浏览模块 Service 单元测试', () => {
  beforeEach(() => {
    resetStore();
  });

  it('正常情况：按关键词和处方类型查询药品，并返回详情安全提示', () => {
    const result = searchMedicines({
      keyword: '阿莫西林',
      prescriptionType: 'PRESCRIPTION',
      page: 1,
      pageSize: 10
    });

    expect(result.total).toBe(1);
    expect(result.list[0]).toMatchObject({
      medicineId: 105,
      name: '阿莫西林胶囊',
      prescriptionType: 'PRESCRIPTION',
      action: '加入购物车'
    });

    const detail = getMedicineDetail(105);
    expect(detail.safetyTips).toContain('该药为处方药，必须上传有效处方并经人工药师审核。');
    expect(detail.contraindication).toContain('青霉素过敏者禁用');
  });

  it('异常情况：查询不存在的药品详情时抛出业务异常', () => {
    expect(() => getMedicineDetail(9999)).toThrow(HttpError);
    expect(() => getMedicineDetail(9999)).toThrow('药品不存在');
  });

  it('边界情况：分页参数越界时自动限制 page 和 pageSize', () => {
    const result = searchMedicines({ page: 0, pageSize: 500 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.total).toBe(store.medicines.length);
  });

  it('边界情况：低库存和缺货药品返回正确库存状态与购买动作', () => {
    const lowStock = getMedicineDetail(102);
    const outOfStock = getMedicineDetail(104);

    expect(lowStock.stockStatus).toBe('LOW_STOCK');
    expect(lowStock.safetyTips).toContain('当前库存较低，请以下单时库存校验为准。');
    expect(outOfStock.stockStatus).toBe('OUT_OF_STOCK');
    expect(outOfStock.action).toBe('不可购买');
  });
});
