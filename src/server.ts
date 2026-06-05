/**
 * 服务端入口：进程启动时执行预置数据校验与初始化
 */
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { ensurePresetConfigs } from "#/server/config";
import { ensurePresetDicts } from "#/server/dict";
import { registerAllTasks } from "#/server/tasks";

// 服务进程启动时同步等待，确保预置数据写入完成后才开始接收请求
await ensurePresetDicts();
await ensurePresetConfigs();
registerAllTasks();

export default createServerEntry({
	fetch(request) {
		return handler.fetch(request);
	},
});
