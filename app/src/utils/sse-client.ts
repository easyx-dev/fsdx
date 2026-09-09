/**
 * 客户端 SSE 流消费工具：读取经 Server Function（x-tss-raw）透传的原始流式 Response，
 * 解析「data: {json}\n\n」格式事件并逐事件回调。用于 AI 批量翻译流式端点。
 */

import type { BatchTranslateSseEvent } from "#/shared-services/i18n/i18n.ai.types";

/**
 * 读取并消费一个流式 `Response`（来自 SFn 流式返回，TanStack Start 已置 x-tss-raw）。
 * 非 2xx 或无 body 时抛错；解析出每个合法 SSE 事件即回调。
 * @param onEvent 每收到一个合法 SSE 事件即回调（逐事件处理）
 */
export async function readSSEStream(
	response: Response,
	onEvent: (event: BatchTranslateSseEvent) => void | Promise<void>,
): Promise<void> {
	if (!response.ok || !response.body) {
		throw new Error(`请求失败(${response.status})`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	const dispatch = (chunk: string) => {
		const dataLine = chunk
			.split("\n")
			.find((line) => line.startsWith("data: "));
		if (!dataLine) return;
		try {
			const event = JSON.parse(dataLine.slice(6)) as BatchTranslateSseEvent;
			void onEvent(event);
		} catch {
			// 忽略非法事件
		}
	};

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx = buffer.indexOf("\n\n");
		while (idx >= 0) {
			const chunk = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 2);
			if (chunk.trim()) dispatch(chunk);
			idx = buffer.indexOf("\n\n");
		}
	}
	if (buffer.trim()) dispatch(buffer);
}
