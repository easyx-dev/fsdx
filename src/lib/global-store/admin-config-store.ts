/**
 * 管理端系统配置 zustand store
 * 进入 admin 时一次性加载客户端可见配置，供全局组件读取
 */
import { create } from "zustand";
import { getVisibleConfigsSFn } from "#/server/config/config.functions";

interface AdminConfigState {
	config: Record<string, string>;
	loaded: boolean;
	loadAll: () => Promise<void>;
}

export const useAdminConfigStore = create<AdminConfigState>((set, get) => ({
	config: {},
	loaded: false,
	loadAll: async () => {
		if (get().loaded) return;
		const config = await getVisibleConfigsSFn();
		set({ config, loaded: true });
	},
}));
