/**
 * 环境变量类型声明：core 包内使用 Vite 编译时常量 import.meta.env.DEV
 * 在 app 的 Vite 构建中编译时由 vite/client 类型增强合并
 */
interface ImportMeta {
	readonly env: {
		readonly DEV: boolean;
	};
}
