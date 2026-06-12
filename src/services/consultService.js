import { currentUserId, nextId, store } from '../data/store.js';
import { defaultAiConfig } from '../config/aiConfig.default.js';
import { HttpError } from '../utils/apiResponse.js';

const HIGH_RISK_WORDS = ['胸痛', '呼吸困难', '过敏', '孕妇', '婴儿', '儿童', '抗生素', '阿莫西林', '处方', '剂量', '相互作用'];

let cachedConfig;

async function loadAiConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const localConfig = await import('../config/aiConfig.js');
    cachedConfig = { ...defaultAiConfig, ...(localConfig.aiConfig || {}) };
  } catch {
    cachedConfig = defaultAiConfig;
  }
  return cachedConfig;
}

export async function getAiModelInfo() {
  const config = await loadAiConfig();
  const provider = process.env.AI_PROVIDER || config.provider || 'mock';
  const apiBase = process.env.AI_API_BASE || config.apiBase || '';
  const model = process.env.AI_MODEL || config.model || 'mock-pharmacist';
  const configured = provider === 'openai-compatible' && Boolean(process.env.AI_API_KEY || config.apiKey) && Boolean(apiBase);
  return {
    provider,
    apiBase: apiBase ? apiBase.replace(/\/v\d+\/?$/, '/v*') : '',
    model: provider === 'mock' ? 'mock-pharmacist' : model,
    modeText: configured ? '真实大模型接口' : 'Mock 本地模拟',
    note: configured ? 'AI 回复由配置的大模型生成' : '未配置完整 API Key/Base，当前使用本地 Mock 回复'
  };
}

function assessRisk(content) {
  const matched = HIGH_RISK_WORDS.filter((word) => content.includes(word));
  if (matched.length >= 2) return { riskLevel: '高', handoffRequired: true, matched };
  if (matched.length === 1) return { riskLevel: '中', handoffRequired: true, matched };
  return { riskLevel: '低', handoffRequired: false, matched };
}

function knowledgeReply(content, risk) {
  let answer = '我可以提供基础用药信息和风险提示。请先确认药品名称、年龄、是否过敏以及是否正在使用其他药物。';
  const medicines = store.medicines.filter((item) => content.includes(item.name.slice(0, 2)) || content.includes(item.name));
  if (medicines.length > 0) {
    const med = medicines[0];
    answer = `${med.name}：${med.indication} 用法用量：${med.usageDosage} 主要禁忌：${med.contraindication}`;
  } else if (content.includes('感冒') || content.includes('发热') || content.includes('咳嗽')) {
    answer = '感冒、发热或咳嗽应先关注体温、持续时间和伴随症状。可查看感冒发热类 OTC 药品说明，避免重复使用含相同成分的药物。';
  } else if (content.includes('腹泻') || content.includes('肠胃')) {
    answer = '腹泻应注意补液和观察精神状态。蒙脱石散可用于腹泻辅助治疗，但便秘患者慎用，儿童用药建议咨询药师。';
  }

  const boundary = '以上内容仅供参考，不替代医生诊断或执业药师处方审核。';
  if (risk.handoffRequired) {
    return `${answer} 当前问题包含${risk.matched.join('、')}等风险因素，建议转人工药师进一步确认。${boundary}`;
  }
  return `${answer} ${boundary}`;
}

async function callConfiguredModel(content, risk) {
  const config = await loadAiConfig();
  const provider = process.env.AI_PROVIDER || config.provider || 'mock';
  if (provider !== 'openai-compatible') return knowledgeReply(content, risk);
  const apiBase = process.env.AI_API_BASE || config.apiBase;
  const apiKey = process.env.AI_API_KEY || config.apiKey;
  const model = process.env.AI_MODEL || config.model || 'gpt-4o-mini';
  if (!apiKey || !apiBase) return knowledgeReply(content, risk);

  const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: '你是线上购药系统的AI药师助手，只能提供辅助信息。高风险、处方调整、特殊人群用药必须建议转人工药师。'
        },
        { role: 'user', content }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) return knowledgeReply(content, risk);
  const data = await response.json();
  return `${data.choices?.[0]?.message?.content || knowledgeReply(content, risk)}\n\n提示：AI建议仅供参考，必要时咨询医生或药师。`;
}

export function createSession(payload) {
  const session = {
    sessionId: nextId(store.consultSessions, 'sessionId', 7001),
    userId: currentUserId,
    sessionType: payload.sessionType || '用药咨询',
    sourcePage: payload.sourcePage || 'user-consult.html',
    sessionSummary: '',
    handoffStatus: '纯AI解决',
    riskLevel: '低',
    createdAt: new Date().toISOString()
  };
  store.consultSessions.unshift(session);
  store.consultMessages.push({
    messageId: nextId(store.consultMessages, 'messageId', 1),
    sessionId: session.sessionId,
    senderType: 'SYSTEM',
    content: 'AI智能药师仅提供辅助参考，高风险问题将提示转人工药师。',
    createdAt: new Date().toISOString()
  });
  return session;
}

export async function sendMessage(sessionId, payload) {
  const session = store.consultSessions.find((item) => item.sessionId === Number(sessionId));
  if (!session) throw new HttpError('咨询会话不存在', 404);
  const content = String(payload.content || '').trim();
  if (!content) throw new HttpError('咨询内容不能为空');

  store.consultMessages.push({
    messageId: nextId(store.consultMessages, 'messageId', 1),
    sessionId: session.sessionId,
    senderType: 'USER',
    content,
    createdAt: new Date().toISOString()
  });

  const risk = assessRisk(content);
  const answer = await callConfiguredModel(content, risk);
  session.sessionSummary = content.slice(0, 80);
  session.riskLevel = risk.riskLevel;
  if (risk.handoffRequired) session.handoffStatus = '建议转人工';

  const aiMessage = {
    messageId: nextId(store.consultMessages, 'messageId', 1),
    sessionId: session.sessionId,
    senderType: 'AI',
    content: answer,
    riskLevel: risk.riskLevel,
    handoffRequired: risk.handoffRequired,
    createdAt: new Date().toISOString()
  };
  store.consultMessages.push(aiMessage);

  if (risk.handoffRequired) {
    store.aiRiskLogs.push({
      riskLogId: nextId(store.aiRiskLogs, 'riskLogId', 1),
      sourceType: 'CONSULT',
      sourceId: session.sessionId,
      riskLevel: risk.riskLevel,
      riskReason: `命中风险词：${risk.matched.join('、')}`,
      createdAt: new Date().toISOString()
    });
  }
  return { reply: aiMessage, riskLevel: risk.riskLevel, handoffRequired: risk.handoffRequired };
}

export function handoff(sessionId, payload) {
  const session = store.consultSessions.find((item) => item.sessionId === Number(sessionId));
  if (!session) throw new HttpError('咨询会话不存在', 404);
  session.handoffStatus = '已转人工';
  session.handoffReason = payload.reason || '用户主动要求人工药师';
  return { sessionId: session.sessionId, handoffStatus: session.handoffStatus, message: '已生成转人工药师记录' };
}

export function listSessions() {
  return {
    total: store.consultSessions.length,
    list: store.consultSessions.map((session) => ({
      ...session,
      messages: store.consultMessages.filter((message) => message.sessionId === session.sessionId)
    }))
  };
}
