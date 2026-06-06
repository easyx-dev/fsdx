/**
 * 服务端入口：进程启动时执行预置数据校验与初始化
 * 环境变量通过 env.d.ts 类型声明 + Vite envDir 加载
 */

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
	fetch(request) {
		return handler.fetch(request);
	},
});
