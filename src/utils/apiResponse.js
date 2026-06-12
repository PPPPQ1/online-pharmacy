export function ok(data = null, message = '操作成功') {
  return { success: true, code: 200, message, data };
}

export function fail(message = '操作失败', code = 400, data = null) {
  return { success: false, code, message, data };
}

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
