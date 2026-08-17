/**
 * AI 模块类型定义：聊天消息、选项、结果、模型类型与依赖注入接口
 */
import type { Logger } from "../logger";

/** 聊天消息 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

/** 聊天选项 */
export interface ChatOptions {
	/** 温度参数，控制输出随机性 (0-2)，默认 0.7 */
	temperature?: number;
	/** 最大输出 token 数 */
	maxTokens?: number;
	/** 额外请求体参数（如 DeepSeek thinking 控制） */
	extraBody?: Record<string, unknown>;
}

/** 聊天结果 */
export interface ChatResult {
	/** 模型回复内容 */
	content: string;
	/** 实际使用的模型名称 */
	model: string;
	/** Token 用量统计 */
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

/** 模型类型 */
export type AiModelType = "deep" | "fast";

/** AI 模块依赖注入 */
export interface AiDeps {
	/** 系统配置读取回调（ai_* 键） */
	getConfig: (key: string) => Promise<string>;
	/** 日志实例 */
	logger: Logger;
}
