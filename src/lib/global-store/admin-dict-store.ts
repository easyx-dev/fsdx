/**
 * 管理端字典 zustand store
 * 进入 admin 时一次性加载全部字典，所有 DictSelect/DictTag 组件同步读取
 */
import { create } from "zustand";
import { getAllDictOptionsSFn } from "#/services/dict/dict.functions";

/** 字典选项 */
export interface DictOption {
	label: string;
	value: string;
	color?: string | null;
}

interface AdminDictState {
	/** 全部字典选项（按 slug 分组） */
	dicts: Record<string, DictOption[]>;
	/** 是否已加载完成 */
	loaded: boolean;
	/** 是否正在加载中 */
	loading: boolean;
	/** 加载全部字典（幂等，已加载则跳过） */
	loadAll: () => Promise<void>;
	/** 刷新全部字典（异步） */
	refresh: () => Promise<void>;
}

export const useAdminDictStore = create<AdminDictState>((set, get) => ({
	dicts: {},
	loaded: false,
	loading: false,
	loadAll: async () => {
		if (get().loaded) return;
		const dicts = await getAllDictOptionsSFn();
		set({ dicts, loaded: true });
	},
	refresh: async () => {
		set({ loading: true });
		const dicts = await getAllDictOptionsSFn();
		set({ dicts, loading: false });
	},
}));
