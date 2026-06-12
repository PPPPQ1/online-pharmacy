import { ok } from '../utils/apiResponse.js';
import { homeOverview, listCategories, searchMedicines, getMedicineDetail } from '../services/medicineService.js';
import { addToCart, deleteCartItem, listCart, updateCartItem } from '../services/cartService.js';
import { createOrder, getOrderDetail, listOrders, payOrder, previewOrder } from '../services/orderService.js';
import { createSession, getAiModelInfo, handoff, listSessions, sendMessage } from '../services/consultService.js';

function match(pathname, pattern) {
  const names = [];
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, (token) => {
    names.push(token.slice(1));
    return '([^/]+)';
  })}$`);
  const values = pathname.match(regex);
  if (!values) return null;
  return Object.fromEntries(names.map((name, index) => [name, values[index + 1]]));
}

export async function route(req, body, url) {
  const { pathname, searchParams } = url;
  const query = Object.fromEntries(searchParams.entries());

  if (req.method === 'GET' && pathname === '/api/v1/home/overview') return ok(homeOverview());
  if (req.method === 'GET' && pathname === '/api/v1/medicine-categories') return ok(listCategories());
  if (req.method === 'GET' && pathname === '/api/v1/medicines') return ok(searchMedicines(query));

  let params = match(pathname, '/api/v1/medicines/:medicineId');
  if (req.method === 'GET' && params) return ok(getMedicineDetail(params.medicineId));

  if (req.method === 'GET' && pathname === '/api/v1/cart/items') return ok(listCart());
  if (req.method === 'POST' && pathname === '/api/v1/cart/items') return ok(addToCart(body), '已加入购物车');
  params = match(pathname, '/api/v1/cart/items/:cartItemId');
  if (req.method === 'PUT' && params) return ok(updateCartItem(params.cartItemId, body), '购物车已更新');
  if (req.method === 'DELETE' && params) return ok(deleteCartItem(params.cartItemId), '购物车商品已删除');

  if (req.method === 'POST' && pathname === '/api/v1/orders/preview') return ok(previewOrder(body));
  if (req.method === 'POST' && pathname === '/api/v1/orders') return ok(createOrder(body), '订单创建成功');
  if (req.method === 'GET' && pathname === '/api/v1/orders') return ok(listOrders(query));
  params = match(pathname, '/api/v1/orders/:orderId');
  if (req.method === 'GET' && params) return ok(getOrderDetail(params.orderId));
  if (req.method === 'POST' && pathname === '/api/v1/payments/prepay') return ok(payOrder(body), '模拟支付成功');

  if (req.method === 'POST' && pathname === '/api/v1/consult/sessions') return ok(createSession(body), '咨询会话已创建');
  if (req.method === 'GET' && pathname === '/api/v1/consult/model-info') return ok(await getAiModelInfo());
  if (req.method === 'GET' && pathname === '/api/v1/consult/sessions') return ok(listSessions());
  params = match(pathname, '/api/v1/consult/sessions/:sessionId/messages');
  if (req.method === 'POST' && params) return ok(await sendMessage(params.sessionId, body), 'AI药师已回复');
  params = match(pathname, '/api/v1/consult/sessions/:sessionId/handoff');
  if (req.method === 'POST' && params) return ok(handoff(params.sessionId, body), '已转人工');

  return null;
}
