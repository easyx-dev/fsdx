/**
 * 服务端初始化：确保定时任务仅注册一次
 */
import { registerAllTasks } from "#/server/tasks";

let initialized = false;

/** 在第一个服务端请求时初始化 */
export function ensureInit(): void {
	if (initialized) return;
	initialized = true;
	registerAllTasks();
}
