/**
 * 文档事实提取：从代码单一事实来源计算事实数据，供生成与校验脚本复用
 * 单一事实来源：权限码 → src/permissions/，数据表 → src/db/schema/，缓存实例 → src/services/
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../src/db/schema/index.ts";
import { ADMIN_PERMISSION_META } from "../src/permissions/admin-permissions.ts";
import { CLIENT_PERMISSION_META } from "../src/permissions/client-permissions.ts";

/** 仓库根目录（app/scripts 向上两级） */
export const ROOT = resolve(
	fileURLToPath(new URL(".", import.meta.url)),
	"../..",
);

/** 缓存实例源码目录（app/src/services，含子目录，如 track.validate.ts 内嵌频控实例） */
const CACHE_SRC_DIR = join(ROOT, "app/src/services");

/** 权限定义结构 */
export interface PermissionDef {
	code: string;
	name: string;
	desc: string;
	group: string;
}

/** 数据表元数据 */
export interface TableMeta {
	/** 数据库表名 */
	name: string;
	/** 列数量 */
	columnCount: number;
	/** 来源 schema 文件路径（相对 app 包） */
	moduleFile: string;
}

/** 文档事实汇总 */
export interface DocFacts {
	/** 数据表清单 */
	tables: TableMeta[];
	/** 管理端权限码清单 */
	adminPermissions: PermissionDef[];
	/** 客户端权限码清单 */
	clientPermissions: PermissionDef[];
	/** 内存缓存实例数量 */
	cacheInstanceCount: number;
}

/** Drizzle 表对象元数据符号 */
const DRIZZLE_SYMBOLS = {
	isTable: Symbol.for("drizzle:IsDrizzleTable"),
	baseName: Symbol.for("drizzle:BaseName"),
	columns: Symbol.for("drizzle:Columns"),
} as const;

/** 读取 Drizzle 表元数据，非表对象返回 null */
function getTableMeta(value: unknown): Omit<TableMeta, "moduleFile"> | null {
	if (typeof value !== "object" || value === null) return null;
	const record = value as Record<symbol, unknown>;
	if (record[DRIZZLE_SYMBOLS.isTable] !== true) return null;
	const columns = (record[DRIZZLE_SYMBOLS.columns] ?? {}) as Record<
		string,
		unknown
	>;
	const name = (record[DRIZZLE_SYMBOLS.baseName] as string | undefined) ?? "";
	return { name, columnCount: Object.keys(columns).length };
}

/** 递归收集目录下全部 .ts 文件（排除测试目录与类型声明） */
function walkTsFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry !== "__tests__") out.push(...walkTsFiles(full));
		} else if (entry.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

/** 遍历 schema 目录，映射 DB 表名 → 来源 schema 文件 */
function buildTableFileMap(): Map<string, string> {
	const dir = join(ROOT, "app/src/db/schema");
	const map = new Map<string, string>();
	for (const file of readdirSync(dir)) {
		if (!file.endsWith(".ts") || file === "index.ts") continue;
		const content = readFileSync(join(dir, file), "utf8");
		for (const match of content.matchAll(/pgTable\(\s*"([^"]+)"/g)) {
			map.set(match[1], `src/db/schema/${file}`);
		}
	}
	return map;
}

/** 从代码计算文档事实 */
export function computeFacts(): DocFacts {
	const tableFileMap = buildTableFileMap();
	const tables: TableMeta[] = Object.values(schema)
		.map((value) => {
			const meta = getTableMeta(value);
			return meta === null
				? null
				: { ...meta, moduleFile: tableFileMap.get(meta.name) ?? "" };
		})
		.filter((table): table is TableMeta => table !== null)
		.sort((a, b) => a.name.localeCompare(b.name));

	const adminPermissions = Object.values(ADMIN_PERMISSION_META);
	const clientPermissions = Object.values(CLIENT_PERMISSION_META);

	// 统计 src/services 下全部 .ts 中 MemoryCache 实例化次数（含 track.validate.ts 内嵌频控实例）
	const cacheInstanceCount = walkTsFiles(CACHE_SRC_DIR).reduce(
		(sum, file) =>
			sum + (readFileSync(file, "utf8").match(/new MemoryCache/g) ?? []).length,
		0,
	);

	return { tables, adminPermissions, clientPermissions, cacheInstanceCount };
}

/** 转义 markdown 表格单元格文本 */
function escapeCell(text: string): string {
	return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** 渲染权限码清单 markdown（按分组排序） */
export function renderPermissions(facts: DocFacts): string {
	const renderGroup = (title: string, defs: PermissionDef[]): string => {
		const groups = [...new Set(defs.map((def) => def.group))].sort();
		const rows = groups.flatMap((group) =>
			defs
				.filter((def) => def.group === group)
				.map(
					(def) =>
						`| ${group} | \`${def.code}\` | ${escapeCell(def.name)} | ${escapeCell(def.desc)} |`,
				),
		);
		return `## ${title}（${defs.length} 个）\n\n| 分组 | 权限码 | 名称 | 说明 |\n|------|--------|------|------|\n${rows.join("\n")}\n`;
	};

	return `# 权限码清单（自动生成）

> 单一事实来源：\`src/permissions/admin-permissions.ts\`（管理端）、\`src/permissions/client-permissions.ts\`（客户端）
> 重新生成：\`pnpm doc:gen\`

${renderGroup("管理端权限码", facts.adminPermissions)}
${renderGroup("客户端权限码", facts.clientPermissions)}
`;
}

/** 渲染数据表清单 markdown */
export function renderTables(facts: DocFacts): string {
	const rows = facts.tables.map(
		(table) =>
			`| ${table.name} | ${table.columnCount} | \`${table.moduleFile}\` |`,
	);
	return `# 数据表清单（自动生成）

> 单一事实来源：\`src/db/schema/index.ts\`（表定义汇总）与 \`src/db/schema/*.ts\`（逐表定义）
> 重新生成：\`pnpm doc:gen\`

共 ${facts.tables.length} 张表

| 表名 | 列数 | Schema 文件 |
|------|------|-------------|
${rows.join("\n")}
`;
}

/** 生成物文件定义（文件名 → 渲染函数） */
export const GENERATED_FILES: {
	file: string;
	render: (facts: DocFacts) => string;
}[] = [
	{ file: "permissions.md", render: renderPermissions },
	{ file: "tables.md", render: renderTables },
];
