/**
 * 字典管理 Server Function：全局共享接口
 */
import { createServerFn } from "@tanstack/react-start";
import { getAllDictOptions } from "#/services/dict/dict.server";

/** 获取全部字典选项（按 slug 分组，供 zustand store 一次性加载） */
export const getAllDictOptionsSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return getAllDictOptions();
	},
);
