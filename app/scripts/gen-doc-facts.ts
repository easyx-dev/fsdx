/**
 * 文档事实生成：从代码单一事实来源生成 docs/generated/ 下的事实快照
 * 运行：pnpm doc:gen（或 pnpm --filter @fsdx/web exec tsx app/scripts/gen-doc-facts.ts）
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeFacts, GENERATED_FILES, ROOT } from "./doc-facts.ts";

/** 生成物目录（仓库根 docs/generated） */
const GENERATED_DIR = join(ROOT, "docs/generated");

/** 生成全部事实快照文件 */
function main(): void {
	const facts = computeFacts();
	mkdirSync(GENERATED_DIR, { recursive: true });
	for (const { file, render } of GENERATED_FILES) {
		writeFileSync(join(GENERATED_DIR, file), render(facts), "utf8");
		console.log(`已生成 docs/generated/${file}`);
	}
}

main();
