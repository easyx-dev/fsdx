/**
 * 文档事实校验：挂入 pnpm check，防止文档中的事实数字与代码漂移
 * ① 校验 docs/generated/ 生成物与代码一致（过期则要求运行 pnpm doc:gen）
 * ② 扫描非生成类文档中出现的「数量 + 单位」短语，与代码实际值比对
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeFacts, GENERATED_FILES, ROOT } from "./doc-facts.ts";

/** 校验的文档范围：仓库根 README/AGENTS + docs/ 顶层非 generated/archive 文件 */
function collectScanTargets(): string[] {
	const targets = [join(ROOT, "README.md"), join(ROOT, "AGENTS.md")];
	const docsDir = join(ROOT, "docs");
	for (const file of readdirSync(docsDir)) {
		if (!file.endsWith(".md")) continue;
		targets.push(join(docsDir, file));
	}
	return targets;
}

/** 从代码事实生成「数量短语 → 期望值」对照表，供全文扫描 */
function buildNumberFacts(): {
	regex: RegExp;
	expected: number;
	label: string;
}[] {
	const facts = computeFacts();
	return [
		{
			regex: /(\d+) 张表/g,
			expected: facts.tables.length,
			label: "数据表数量",
		},
		{
			regex: /(\d+) 个缓存实例/g,
			expected: facts.cacheInstanceCount,
			label: "缓存实例数量",
		},
		{
			regex: /(\d+) 个权限常量/g,
			expected: facts.adminPermissions.length,
			label: "管理端权限码数量",
		},
	];
}

/** 校验生成物与代码一致 */
function verifyGenerated(): string[] {
	const errors: string[] = [];
	const facts = computeFacts();
	const generatedDir = join(ROOT, "docs/generated");
	for (const { file, render } of GENERATED_FILES) {
		const path = join(generatedDir, file);
		if (!existsSync(path) || readFileSync(path, "utf8") !== render(facts)) {
			errors.push(
				`docs/generated/${file} 已过期，请运行 pnpm doc:gen 重新生成`,
			);
		}
	}
	return errors;
}

/** 限定词守卫：数字前紧跟「约/新/增/多/少/达/每」等量词时视为非事实性表述（如「新增 2 张表」「约 30 张表」），跳过避免误报 */
const NON_FACTUAL_QUALIFIERS = /[约新增减多少达每近]/;

/** 扫描文档中的事实数字，与代码比对 */
function verifyNumbers(): string[] {
	const errors: string[] = [];
	const numberFacts = buildNumberFacts();
	for (const target of collectScanTargets()) {
		const content = readFileSync(target, "utf8");
		for (const { regex, expected, label } of numberFacts) {
			for (const match of content.matchAll(regex)) {
				const matchIndex = match.index ?? 0;
				// 取匹配位置前 3 字符（含可能的空格），命中限定词则视为非事实性表述跳过
				const qualifier = content.slice(
					Math.max(0, matchIndex - 3),
					matchIndex,
				);
				if (NON_FACTUAL_QUALIFIERS.test(qualifier)) continue;
				const stated = Number(match[1]);
				if (stated !== expected) {
					const relative = target.replace(`${ROOT}/`, "");
					errors.push(
						`${relative} 第 ${lineOf(content, matchIndex)} 行「${label}」写为 ${stated}，实际应为 ${expected}`,
					);
				}
			}
		}
	}
	return errors;
}

/** 计算指定偏移量所在行号 */
function lineOf(content: string, offset: number): number {
	return content.slice(0, offset).split("\n").length;
}

/** 主入口：任一校验失败即非零退出 */
function main(): void {
	const errors = [...verifyGenerated(), ...verifyNumbers()];
	if (errors.length > 0) {
		console.error("[doc-facts] 文档事实校验失败：");
		for (const error of errors) {
			console.error(`  ✗ ${error}`);
		}
		process.exitCode = 1;
	} else {
		console.log("[doc-facts] 文档事实校验通过");
	}
}

main();
