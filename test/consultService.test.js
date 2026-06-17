import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, store } from '../src/data/store.js';
import { createSession, getAiModelInfo, handoff, sendMessage } from '../src/services/consultService.js';

describe('智能药师咨询模块 Service 单元测试', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
    delete process.env.AI_API_BASE;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    process.env.AI_PROVIDER = 'mock';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_BASE;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
  });

  it('正常情况：Mock 模式下发送普通咨询，不真实调用大模型 API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const session = createSession({ sessionType: '用药咨询' });

    const result = await sendMessage(session.sessionId, { content: '感冒灵颗粒怎么吃？' });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.handoffRequired).toBe(false);
    expect(result.riskLevel).toBe('低');
    expect(result.reply.source).toBe('mock');
    expect(result.reply.content).toContain('感冒灵颗粒');
    expect(store.consultMessages.filter((item) => item.sessionId === session.sessionId)).toHaveLength(3);
  });

  it('正常情况：使用 Stub 模拟 OpenAI 兼容大模型返回，不访问真实网络', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_API_BASE = 'https://stub.example/v1';
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'stub-deepseek';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Stub 模型回复：高血压患者应谨慎选择含伪麻黄碱药物。' } }]
      })
    });
    const session = createSession({ sessionType: '用药咨询' });

    const result = await sendMessage(session.sessionId, { content: '我有高血压，鼻塞能吃伪麻黄碱吗？' });

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(result.reply.source).toBe('model');
    expect(result.reply.sourceLabel).toBe('真实模型：stub-deepseek');
    expect(result.reply.content).toContain('Stub 模型回复');
  });

  it('异常情况：空消息和不存在的会话会抛出业务异常', async () => {
    const session = createSession({ sessionType: '用药咨询' });

    await expect(sendMessage(session.sessionId, { content: '   ' })).rejects.toThrow('咨询内容不能为空');
    await expect(sendMessage(99999, { content: '感冒怎么办？' })).rejects.toThrow('咨询会话不存在');
  });

  it('边界情况：命中多个高风险词时要求转人工并写入风险日志', async () => {
    const session = createSession({ sessionType: '用药咨询' });

    const result = await sendMessage(session.sessionId, { content: '孕妇可以吃阿莫西林吗，会不会过敏？' });

    expect(result.handoffRequired).toBe(true);
    expect(result.riskLevel).toBe('高');
    expect(result.reply.source).toBe('mock');
    expect(store.consultSessions[0].handoffStatus).toBe('建议转人工');
    expect(store.aiRiskLogs).toHaveLength(1);
    expect(store.aiRiskLogs[0].riskReason).toContain('孕妇');
  });

  it('边界情况：用户主动转人工时更新会话状态', () => {
    const session = createSession({ sessionType: '禁忌查询' });

    const result = handoff(session.sessionId, { reason: '用户要求人工复核' });

    expect(result.handoffStatus).toBe('已转人工');
    expect(store.consultSessions[0].handoffReason).toBe('用户要求人工复核');
  });

  it('边界情况：模型配置未完整时显示 Mock 本地模拟', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_API_BASE = 'https://api.siliconflow.cn/v1';
    process.env.AI_API_KEY = '请替换为你的硅基流动 API Key';

    const info = await getAiModelInfo();

    expect(info.provider).toBe('openai-compatible');
    expect(info.modeText).toBe('Mock 本地模拟');
  });
});
