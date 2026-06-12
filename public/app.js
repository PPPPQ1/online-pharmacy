const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.message);
  return payload.data;
};

const state = {
  currentSessionId: null,
  medicines: []
};

const $ = (selector) => document.querySelector(selector);

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  window.setTimeout(() => node.classList.remove('show'), 2400);
}

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function stockText(item) {
  if (item.stockStatus === 'OUT_OF_STOCK') return '缺货';
  if (item.stockStatus === 'LOW_STOCK') return `低库存 ${item.stockQuantity}`;
  return `库存 ${item.stockQuantity}`;
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach((node) => node.classList.toggle('active', node.id === viewId));
  document.querySelectorAll('.nav-btn').forEach((node) => node.classList.toggle('active', node.dataset.view === viewId));
  if (viewId === 'cart') loadCart();
  if (viewId === 'orders') loadOrders();
  if (viewId === 'consult') loadConsultRecords();
}

async function initHome() {
  const [overview, categories] = await Promise.all([
    api('/api/v1/home/overview'),
    api('/api/v1/medicine-categories')
  ]);
  $('#keyword').placeholder = overview.searchPlaceholder;
  $('#category').innerHTML = '<option value="">全部分类</option>'
    + categories.map((item) => `<option value="${item.categoryId}">${item.categoryName}</option>`).join('');
  await loadMedicines();
  await createConsultSession();
}

async function loadMedicines() {
  const params = new URLSearchParams({
    keyword: $('#keyword').value.trim(),
    categoryId: $('#category').value,
    prescriptionType: $('#prescriptionType').value,
    sort: $('#sort').value,
    page: '1',
    pageSize: '20'
  });
  const data = await api(`/api/v1/medicines?${params}`);
  state.medicines = data.list;
  $('#medicineList').innerHTML = data.list.map((item) => `
    <article class="card">
      <div class="medicine-media" style="background:${item.imageColor}">${item.name}</div>
      <h3>${item.name}</h3>
      <div class="meta">${item.specification} · ${item.manufacturer}</div>
      <div class="tags">
        ${item.tags.map((tag) => `<span class="tag ${tag.includes('低') || tag.includes('处方') ? 'warn' : ''}">${tag}</span>`).join('')}
        <span class="tag">${stockText(item)}</span>
      </div>
      <div class="price">${money(item.price)}</div>
      <div class="meta">批准文号：${item.approvalNo}</div>
      <div class="actions">
        <button class="secondary" data-detail="${item.medicineId}">详情</button>
        <button data-add="${item.medicineId}" ${item.stockStatus === 'OUT_OF_STOCK' ? 'disabled' : ''}>加购</button>
      </div>
    </article>
  `).join('') || '<div class="summary">未找到匹配药品，请更换关键词或筛选条件。</div>';
}

async function showDetail(medicineId) {
  const item = await api(`/api/v1/medicines/${medicineId}`);
  $('#medicineDetail').innerHTML = `
    <h2>${item.name}</h2>
    <div class="detail-grid">
      <p><strong>规格：</strong>${item.specification}</p>
      <p><strong>厂家：</strong>${item.manufacturer}</p>
      <p><strong>类型：</strong>${item.prescriptionType === 'PRESCRIPTION' ? '处方药' : 'OTC'}</p>
      <p><strong>库存：</strong>${stockText(item)}</p>
      <p><strong>适应症：</strong>${item.indication}</p>
      <p><strong>用法用量：</strong>${item.usageDosage}</p>
    </div>
    <div class="notice"><strong>安全提示：</strong>${item.safetyTips.join(' ')}</div>
  `;
}

async function addMedicine(medicineId) {
  await api('/api/v1/cart/items', { method: 'POST', body: { medicineId: Number(medicineId), quantity: 1, source: 'user-search.html' } });
  toast('已加入购物车');
  await loadCart();
}

async function loadCart() {
  const data = await api('/api/v1/cart/items');
  $('#cartList').innerHTML = data.items.map((item) => `
    <div class="row">
      <div>
        <strong>${item.name}</strong>
        <div class="meta">${item.specification} · ${item.prescriptionType === 'PRESCRIPTION' ? '处方药需审核' : 'OTC'} · ${stockText(item)}</div>
      </div>
      <label><input type="checkbox" data-select="${item.cartItemId}" ${item.selected ? 'checked' : ''}/> 选中</label>
      <div class="qty">
        <input type="number" min="1" max="${item.stockQuantity}" value="${item.quantity}" data-qty="${item.cartItemId}" />
      </div>
      <button class="secondary" data-delete="${item.cartItemId}">删除</button>
    </div>
  `).join('') || '<div class="summary">购物车为空，请先选择可售药品。</div>';
  $('#cartSummary').innerHTML = `已选 ${data.summary.selectedCount} 件，商品金额 ${money(data.summary.productAmount)}，优惠 ${money(data.summary.discountAmount)}，应付 <strong>${money(data.summary.payableAmount)}</strong>`;
}

async function updateCartItem(itemId, patch) {
  await api(`/api/v1/cart/items/${itemId}`, { method: 'PUT', body: patch });
  await loadCart();
}

async function checkout() {
  const cart = await api('/api/v1/cart/items');
  const ids = cart.items.filter((item) => item.selected).map((item) => item.cartItemId);
  if (ids.length === 0) return toast('请先选择购物车商品');
  const preview = await api('/api/v1/orders/preview', { method: 'POST', body: { cartItemIds: ids, deliveryType: '同城配送' } });
  $('#orderPreview').innerHTML = `
    <h3>订单确认</h3>
    <p class="meta">收货人：${preview.address.receiverName}，${preview.address.receiverPhone}，${preview.address.detailAddress}</p>
    <p class="notice">${preview.riskNotice}</p>
    <p>应付金额：<strong>${money(preview.summary.payableAmount)}</strong></p>
    <button id="submitOrderBtn">确认下单</button>
  `;
  $('#submitOrderBtn').addEventListener('click', async () => {
    const order = await api('/api/v1/orders', {
      method: 'POST',
      body: { cartItemIds: ids, deliveryType: '同城配送', payMethod: 'WECHAT', agreementAccepted: true }
    });
    toast(`订单创建成功：${order.orderStatus}`);
    $('#orderPreview').innerHTML = '';
    await loadCart();
    await loadOrders();
    switchView('orders');
  });
}

async function loadOrders() {
  const data = await api('/api/v1/orders');
  $('#orderList').innerHTML = data.list.map((order) => `
    <article class="order-card">
      <div class="section-head">
        <div>
          <strong>${order.orderNo}</strong>
          <div class="meta">${new Date(order.createdAt).toLocaleString()} · ${order.items.map((item) => item.medicineName).join('、')}</div>
        </div>
        <span class="status">${order.orderStatus}</span>
      </div>
      <p>应付金额：${money(order.payableAmount)}</p>
      <div class="actions">
        <button data-pay="${order.orderId}" ${order.orderStatus !== '待支付' ? 'disabled' : ''}>模拟支付</button>
      </div>
    </article>
  `).join('') || '<div class="summary">暂无订单。</div>';
}

async function createConsultSession() {
  const session = await api('/api/v1/consult/sessions', { method: 'POST', body: { sessionType: '用药咨询', sourcePage: 'user-consult.html' } });
  state.currentSessionId = session.sessionId;
  renderChat([{ senderType: 'SYSTEM', content: 'AI智能药师已就绪，请输入药品或用药问题。' }]);
}

function renderChat(messages) {
  $('#chatMessages').innerHTML = messages.map((message) => `
    <div class="msg ${message.senderType}">${message.senderType}：${message.content}</div>
  `).join('');
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

async function sendConsult() {
  const content = $('#consultInput').value.trim();
  if (!content) return toast('请输入咨询内容');
  $('#consultInput').value = '';
  const records = await api('/api/v1/consult/sessions');
  const current = records.list.find((item) => item.sessionId === state.currentSessionId);
  renderChat([...(current?.messages || []), { senderType: 'USER', content }]);
  const result = await api(`/api/v1/consult/sessions/${state.currentSessionId}/messages`, { method: 'POST', body: { content } });
  const updated = await api('/api/v1/consult/sessions');
  renderChat(updated.list.find((item) => item.sessionId === state.currentSessionId)?.messages || []);
  if (result.handoffRequired) toast('该问题建议转人工药师');
  await loadConsultRecords();
}

async function handoffConsult() {
  await api(`/api/v1/consult/sessions/${state.currentSessionId}/handoff`, { method: 'POST', body: { reason: '用户主动要求人工药师' } });
  toast('已生成转人工记录');
  await loadConsultRecords();
}

async function loadConsultRecords() {
  const data = await api('/api/v1/consult/sessions');
  $('#consultRecords').innerHTML = data.list.map((item) => `
    <div class="record">
      <strong>${item.sessionType}</strong>
      <div class="meta">${item.sessionSummary || '尚无用户问题'}</div>
      <div>风险：${item.riskLevel} · ${item.handoffStatus}</div>
    </div>
  `).join('');
}

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (target.matches('.nav-btn')) switchView(target.dataset.view);
  if (target.dataset.detail) showDetail(target.dataset.detail).catch((error) => toast(error.message));
  if (target.dataset.add) addMedicine(target.dataset.add).catch((error) => toast(error.message));
  if (target.dataset.delete) {
    await api(`/api/v1/cart/items/${target.dataset.delete}`, { method: 'DELETE' });
    await loadCart();
  }
  if (target.dataset.pay) {
    await api('/api/v1/payments/prepay', { method: 'POST', body: { orderId: Number(target.dataset.pay), payMethod: 'WECHAT' } })
      .then(() => toast('模拟支付成功'))
      .catch((error) => toast(error.message));
    await loadOrders();
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.dataset.select) updateCartItem(target.dataset.select, { selected: target.checked }).catch((error) => toast(error.message));
  if (target.dataset.qty) updateCartItem(target.dataset.qty, { quantity: Number(target.value) }).catch((error) => toast(error.message));
});

$('#searchBtn').addEventListener('click', () => loadMedicines().catch((error) => toast(error.message)));
$('#keyword').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loadMedicines().catch((error) => toast(error.message));
});
$('#checkoutBtn').addEventListener('click', () => checkout().catch((error) => toast(error.message)));
$('#refreshOrdersBtn').addEventListener('click', () => loadOrders().catch((error) => toast(error.message)));
$('#sendConsultBtn').addEventListener('click', () => sendConsult().catch((error) => toast(error.message)));
$('#consultInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') sendConsult().catch((error) => toast(error.message));
});
$('#handoffBtn').addEventListener('click', () => handoffConsult().catch((error) => toast(error.message)));

initHome().catch((error) => toast(error.message));
