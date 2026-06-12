# 线上购药系统演示项目

本项目根据根目录中的需求规格、功能模块、数据库表、接口设计和代码设计说明书实现，范围聚焦三类功能：

- 药品查询与浏览模块：分类、关键词、处方类型、排序、药品详情和用药安全提示。
- 购物车与订单模块：加入购物车、数量修改、删除、订单预览、确认下单、模拟支付、订单状态查询。
- 智能药师咨询模块：创建咨询会话、AI/Mock 回复、风险识别、转人工提示、咨询记录留痕。

## 技术说明

- 运行环境：Node.js 18+。
- 后端：零第三方依赖，使用 Node.js 原生 HTTP 服务。
- 前端：原生 HTML/CSS/JavaScript。
- 数据：内存模拟 `medicine_info`、`cart_item`、`order_main`、`order_item`、`consult_session`、`consult_message` 等核心表。
- 接口前缀：`/api/v1`，与接口设计说明书保持一致。

## 运行方式

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

默认使用 Mock 大模型接口。首次使用时可以复制示例配置：

```bash
cp src/config/aiConfig.example.js src/config/aiConfig.js
```

Windows PowerShell：

```powershell
Copy-Item src/config/aiConfig.example.js src/config/aiConfig.js
```

然后修改 `src/config/aiConfig.js`。该文件已加入 `.gitignore`，不会上传 API Key。

配置说明：

- `provider: 'mock'`：使用本地 Mock 回复，不需要 API Key。
- `provider: 'openai-compatible'`：调用 OpenAI 兼容 `/chat/completions` 接口。
- `apiBase`：接口地址，通常以 `/v1` 结尾。
- `apiKey`：你的大模型 API Key。
- `model`：模型名称。

硅基流动 DeepSeek 示例：

```js
export const aiConfig = {
  provider: 'openai-compatible',
  apiBase: 'https://api.siliconflow.cn/v1',
  apiKey: '请替换为你的硅基流动 API Key',
  model: 'deepseek-ai/DeepSeek-V3.2'
};
```

如果你的账号模型列表中显示的是其他 DeepSeek 版本，可只修改 `model`，例如 `Pro/deepseek-ai/DeepSeek-V3.2`、`deepseek-ai/DeepSeek-R1`。

环境变量仍然可用，并且优先级高于配置文件，适合临时覆盖。

## 主要接口

- `GET /api/v1/home/overview`
- `GET /api/v1/medicine-categories`
- `GET /api/v1/medicines?keyword=感冒&sort=sales_desc`
- `GET /api/v1/medicines/{medicineId}`
- `GET /api/v1/cart/items`
- `POST /api/v1/cart/items`
- `PUT /api/v1/cart/items/{cartItemId}`
- `DELETE /api/v1/cart/items/{cartItemId}`
- `POST /api/v1/orders/preview`
- `POST /api/v1/orders`
- `POST /api/v1/payments/prepay`
- `GET /api/v1/orders`
- `POST /api/v1/consult/sessions`
- `POST /api/v1/consult/sessions/{sessionId}/messages`
- `POST /api/v1/consult/sessions/{sessionId}/handoff`
- `GET /api/v1/consult/sessions`

## 测试步骤

1. 进入首页，搜索“感冒”或筛选“感冒发热”，查看药品列表。
2. 点击“详情”，检查规格、批准文号、适应症、禁忌和安全提示。
3. 点击“加购”，进入购物车修改数量或删除商品。
4. 点击“生成订单”，确认收货地址、风险提示和金额，提交订单。
5. 在订单页对非处方药订单点击“模拟支付”，订单状态应变为“待配送”。
6. 在 AI 药师页输入“感冒灵颗粒怎么吃”，查看普通咨询回复。
7. 输入“孕妇可以吃阿莫西林吗，有没有过敏风险”，应提示高风险并建议转人工。

自动测试：

```bash
npm test
```

## 打包上传说明

工程可直接压缩上传。请保留：

- `package.json`
- `src/`
- `public/`
- `test/`
- `README.md`

不要包含 `node_modules/`、`.env`、日志文件或其他第三方依赖目录。
