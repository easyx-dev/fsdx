import { drizzle } from "drizzle-orm/node-postgres";

/** 辅助函数：捕获 drizzle 的完整返回类型 */
function createDb() {
	return drizzle(process.env.DATABASE_URL);
}

let _dbInstance: ReturnType<typeof createDb> | null = null;

/** 懒加载 db 实例的 Proxy：所有属性访问触发时初始化，延迟 db 实例初始化至首次属性访问 */
export const db = new Proxy({} as any, {
	get(_, prop) {
		if (!_dbInstance) {
			_dbInstance = createDb();
		}
		return (_dbInstance as any)[prop];
	},
}) as unknown as ReturnType<typeof createDb>;
