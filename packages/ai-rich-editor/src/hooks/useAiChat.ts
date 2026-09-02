/**
 * AI 对话状态 hook：基于 @tanstack/ai-react 的 useChat 重实现
 * 消费宿主透传的 SSE 端点，驱动 UI。把 TanStack 的 UIMessage（parts: text/thinking/tool）
 * 映射为包内 ChatTurn（text 拼接为 content，thinking 单独字段）。
 * 组件不感知传输层，端点由调用方注入（endpointUrl）。
 */
import {
	fetchServerSentEvents,
	type UIMessage,
	useChat,
} from "@tanstack/ai-react";
import { useCallback, useMemo, useRef } from "react";
import { buildDefaultSystemPrompt } from "../prompts";
import type { AiChatUsage, ChatTurn } from "../types";

/** useAiChat 入参 */
export interface UseAiChatOptions {
	/** 对话流式 SSE 端点 URL */
	endpointUrl: string;
	/** 自定义 system 提示词（可选，缺省用包内置模板；随每次发送透传给服务端） */
	systemPrompt?: string;
	/** 随每次发送透传给服务端的附加元数据（合并进 forwardedProps，如 { providerId }） */
	requestMeta?: Record<string, unknown>;
	/** 单轮流正常结束时回调（内容为完整回复，供自动应用编辑器等联动） */
	onComplete?: (content: string) => void;
}

/** 对话状态与操作 */
export interface AiChatController {
	/** 完整对话历史（已完成轮次；流式中的生成中气泡不在此列） */
	messages: ChatTurn[];
	/** 正在流式输出的文本（流结束前逐字增长） */
	streamText: string;
	/** 正在流式输出的思考内容（reasoning，逐段累积，用于「思考中…」气泡） */
	thinkingText: string;
	isStreaming: boolean;
	error: string | null;
	/** 最近一次生成使用的模型名 */
	model: string | null;
	/** 最近一次生成 token 用量 */
	usage: AiChatUsage | null;
	/** 发送一条用户消息 */
	send: (text: string) => Promise<void>;
	/** 中止当前生成 */
	stop: () => void;
	/** 清空对话 */
	clear: () => void;
}

/** 提取文本 part 内容 */
function textOf(message: UIMessage): string {
	let text = "";
	for (const part of message.parts) {
		if (part.type === "text") text += part.content;
	}
	return text;
}

/** 提取思考 part 内容 */
function thinkingOf(message: UIMessage): string {
	let thinking = "";
	for (const part of message.parts) {
		if (part.type === "thinking") thinking += part.content;
	}
	return thinking;
}

/** 将 UIMessage 映射为包内 ChatTurn */
function toChatTurn(message: UIMessage): ChatTurn {
	const thinking = thinkingOf(message);
	return {
		role: message.role === "assistant" ? "assistant" : "user",
		content: textOf(message),
		thinking: thinking || undefined,
	};
}

export function useAiChat({
	endpointUrl,
	systemPrompt,
	requestMeta,
	onComplete,
}: UseAiChatOptions): AiChatController {
	const systemPromptRef = useRef(systemPrompt);
	const requestMetaRef = useRef(requestMeta);
	const onCompleteRef = useRef(onComplete);
	systemPromptRef.current = systemPrompt;
	requestMetaRef.current = requestMeta;
	onCompleteRef.current = onComplete;

	// 稳定 connection / onFinish 引用：避免每次渲染重建 ChatClient（会重置消息状态）
	const connection = useMemo(
		() => fetchServerSentEvents(endpointUrl),
		[endpointUrl],
	);
	const handleFinish = useCallback((message: UIMessage) => {
		const content = textOf(message);
		if (content.trim()) onCompleteRef.current?.(content);
	}, []);

	const {
		messages: tanMessages,
		sendMessage,
		stop: stopFn,
		setMessages,
		isLoading,
		error,
	} = useChat({
		connection,
		onFinish: handleFinish,
	});

	// 判定「流式中的生成中气泡」：isLoading 且最后一条为 assistant 消息
	const last =
		tanMessages.length > 0 ? tanMessages[tanMessages.length - 1] : undefined;
	const isStreaming = isLoading && !!last && last.role === "assistant";

	// 已完成消息 = 移除流式中的末条 assistant 占位，避免与流式气泡重复渲染
	const messages = isStreaming
		? tanMessages.slice(0, -1).map(toChatTurn)
		: tanMessages.map(toChatTurn);
	const streamText = isStreaming && last ? textOf(last) : "";
	const thinkingText = isStreaming && last ? thinkingOf(last) : "";

	const send = useCallback(
		async (text: string) => {
			const prompt = text.trim();
			if (!prompt || isLoading) return;
			// 请求元数据先展开、system 提示词兜底，避免宿主误传 systemPrompt 时覆盖包内生成的提示词
			await sendMessage(prompt, {
				body: {
					...requestMetaRef.current,
					systemPrompt: systemPromptRef.current ?? buildDefaultSystemPrompt(),
				},
			});
		},
		[sendMessage, isLoading],
	);

	const stop = useCallback(() => stopFn(), [stopFn]);
	const clear = useCallback(() => setMessages([]), [setMessages]);

	return {
		messages,
		streamText,
		thinkingText,
		isStreaming,
		error: error ? error.message : null,
		model: null,
		usage: null,
		send,
		stop,
		clear,
	};
}
