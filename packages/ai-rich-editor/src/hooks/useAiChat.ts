/**
 * AI 对话状态 hook：消费 AiChatAdapter（AsyncIterable 流）驱动 UI
 * 负责：发送/流式消费/中止/清空，结构化 assistant 消息（含代码块提取）
 * 组件不感知传输层，adapter 由调用方注入
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_MAX_TURNS } from "../constants";
import { buildDefaultSystemPrompt } from "../prompts";
import type { AiChatAdapter, AiChatUsage, ChatTurn } from "../types";

/** 打字机动画每帧最多推进的字符数 */
const TYPEWRITER_STEP = 12;

/** useAiChat 入参 */
export interface UseAiChatOptions {
	/** 当前编辑器 HTML（每次发送时作为快照注入） */
	currentHtml: string;
	/** 对话适配器 */
	adapter: AiChatAdapter;
	/** 自定义 system 提示词（可选，缺省用包内置模板） */
	systemPrompt?: string;
	/** 单轮流正常结束时回调（内容为完整回复，供自动应用编辑器等联动） */
	onComplete?: (content: string) => void;
}

/** 对话状态与操作 */
export interface AiChatController {
	/** 完整对话历史 */
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

export function useAiChat({
	currentHtml,
	adapter,
	systemPrompt,
	onComplete,
}: UseAiChatOptions): AiChatController {
	const [messages, setMessages] = useState<ChatTurn[]>([]);
	const [streamText, setStreamText] = useState("");
	const [thinkingText, setThinkingText] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [model, setModel] = useState<string | null>(null);
	const [usage, setUsage] = useState<AiChatUsage | null>(null);

	// ref 镜像：send 内读取最新值，避免闭包过期导致连发丢消息
	const messagesRef = useRef<ChatTurn[]>([]);
	const currentHtmlRef = useRef(currentHtml);
	const adapterRef = useRef(adapter);
	const systemPromptRef = useRef(systemPrompt);
	const isStreamingRef = useRef(false);
	const abortRef = useRef<AbortController | null>(null);
	const onCompleteRef = useRef(onComplete);

	// 打字机节流：streamText 按帧渐进推进，即使后端一次性返回也呈现逐字效果
	const fullRef = useRef("");
	const displayRef = useRef("");
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		currentHtmlRef.current = currentHtml;
	}, [currentHtml]);
	useEffect(() => {
		adapterRef.current = adapter;
	}, [adapter]);
	useEffect(() => {
		systemPromptRef.current = systemPrompt;
	}, [systemPrompt]);
	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);
	// 卸载时取消打字机动画
	useEffect(
		() => () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		},
		[],
	);

	/** 启动打字机动画：每帧将 streamText 向 fullRef 推进固定步长 */
	const startTypewriter = useCallback(() => {
		if (rafRef.current !== null) return;
		const tick = () => {
			rafRef.current = null;
			const target = fullRef.current;
			const current = displayRef.current;
			if (current.length < target.length) {
				const next = target.slice(0, current.length + TYPEWRITER_STEP);
				displayRef.current = next;
				setStreamText(next);
			}
			// 仍在生成或有未显示内容时继续推进
			if (
				isStreamingRef.current ||
				displayRef.current.length < fullRef.current.length
			) {
				rafRef.current = requestAnimationFrame(tick);
			}
		};
		rafRef.current = requestAnimationFrame(tick);
	}, []);

	/** 立即将打字机文本跳到完整内容（流结束时调用） */
	const flushTypewriter = useCallback(() => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		displayRef.current = fullRef.current;
		setStreamText(fullRef.current);
	}, []);

	const send = useCallback(
		async (text: string) => {
			const prompt = text.trim();
			if (!prompt || isStreamingRef.current) return;

			const userMessage: ChatTurn = { role: "user", content: prompt };
			const history = [...messagesRef.current, userMessage];
			messagesRef.current = history;
			setMessages(history);
			setStreamText("");
			setError(null);
			setModel(null);
			setUsage(null);
			isStreamingRef.current = true;
			setIsStreaming(true);

			const controller = new AbortController();
			abortRef.current = controller;
			let full = "";
			let thinking = "";
			let errored = false;
			let saved = false;
			fullRef.current = "";
			displayRef.current = "";
			setThinkingText("");
			try {
				// 裁剪最旧轮次（user + assistant 为一轮），保留最近 N 轮
				const trimmed = history.slice(-CHAT_MAX_TURNS * 2);
				const request = {
					messages: trimmed,
					snapshot: currentHtmlRef.current,
					systemPrompt: systemPromptRef.current ?? buildDefaultSystemPrompt(),
				};
				for await (const chunk of adapterRef.current(
					request,
					controller.signal,
				)) {
					if (chunk.type === "thinking") {
						thinking += chunk.text;
						setThinkingText(thinking);
					} else if (chunk.type === "delta") {
						full += chunk.text;
						fullRef.current = full;
						startTypewriter();
					} else if (chunk.type === "attempt") {
						// deep→fast 降级：清空残缺的思考片段与已输出的正文，
						// 避免 deep 已中断的推理过程混入 fast 重新生成的完整结果
						thinking = "";
						setThinkingText("");
						full = "";
						fullRef.current = "";
						displayRef.current = "";
						if (rafRef.current !== null) {
							cancelAnimationFrame(rafRef.current);
							rafRef.current = null;
						}
						setStreamText("");
					} else if (chunk.type === "done") {
						setModel(chunk.model);
						setUsage(chunk.usage ?? null);
					} else if (chunk.type === "error") {
						errored = true;
						setError(chunk.message);
					}
				}

				// 流正常结束且无错误帧：保留累积内容为 assistant 消息
				if (!errored && full.trim()) {
					const next = [
						...messagesRef.current,
						{
							role: "assistant",
							content: full,
							thinking: thinking.trim() ? thinking : undefined,
						} as ChatTurn,
					];
					messagesRef.current = next;
					setMessages(next);
					saved = true;
					// 触发「自动应用到编辑器」等联动的完成回调
					onCompleteRef.current?.(full);
				}
			} catch (err) {
				if (controller.signal.aborted) {
					// 用户清空对话（clear）触发的中止不算错误：messages 已清空时跳过提示
					if (messagesRef.current.length > 0) setError("已停止生成");
				} else {
					setError(err instanceof Error ? err.message : "AI 调用失败");
				}
			} finally {
				if (saved) {
					// 成功：清除打字机占位，完整内容已由 assistant 消息展示，避免重复
					if (rafRef.current !== null) {
						cancelAnimationFrame(rafRef.current);
						rafRef.current = null;
					}
					fullRef.current = "";
					displayRef.current = "";
					setStreamText("");
				} else {
					// 失败/中止：保留已输出的部分文本供查看
					flushTypewriter();
				}
				isStreamingRef.current = false;
				setIsStreaming(false);
				abortRef.current = null;
			}
		},
		[startTypewriter, flushTypewriter],
	);

	const stop = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	const clear = useCallback(() => {
		messagesRef.current = [];
		abortRef.current?.abort();
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		fullRef.current = "";
		displayRef.current = "";
		setMessages([]);
		setStreamText("");
		setThinkingText("");
		setError(null);
		setModel(null);
		setUsage(null);
	}, []);

	return {
		messages,
		streamText,
		thinkingText,
		isStreaming,
		error,
		model,
		usage,
		send,
		stop,
		clear,
	};
}
