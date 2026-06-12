/**
 * 客户端埋点追踪 SDK：自动采集页面信息，通过 Server Function 上报事件到服务端
 */
import { trackEventFn } from "#/server/event/event.functions";

interface TrackConfig {
	/** 是否自动采集 PageView 事件 */
	autoPageView?: boolean;
}

interface TrackState {
	sessionId: string;
	userId: string | undefined;
	config: TrackConfig;
}

const SESSION_KEY = "_track_session_id";

function generateSessionId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 10);
	return `${timestamp}-${random}`;
}

function getOrCreateSessionId(): string {
	if (typeof window === "undefined") return "";
	const stored = sessionStorage.getItem(SESSION_KEY);
	if (stored) return stored;
	const newId = generateSessionId();
	sessionStorage.setItem(SESSION_KEY, newId);
	return newId;
}

const state: TrackState = {
	sessionId: "",
	userId: undefined,
	config: { autoPageView: true },
};

/** 初始化追踪 SDK，自动采集 PageView */
export function init(config?: TrackConfig): void {
	if (typeof window === "undefined") return;

	state.config = { ...state.config, ...config };
	state.sessionId = getOrCreateSessionId();

	if (state.config.autoPageView) {
		track("PageView", {});
	}
}

/** 设置当前用户 ID（登录后调用） */
export function setUserId(userId: string | undefined): void {
	state.userId = userId;
}

/** 获取当前会话 ID */
export function getSessionId(): string {
	return state.sessionId;
}

/** 手动上报事件 */
export async function track(
	eventName: string,
	properties: Record<string, unknown>,
): Promise<void> {
	if (typeof window === "undefined") return;

	// 自动采集通用属性
	const autoProps: Record<string, unknown> = {
		url: window.location.href,
		referer: document.referrer || undefined,
		page_name: document.title,
		$screen_size: `${window.screen.width}x${window.screen.height}`,
	};

	const payload = {
		time: Date.now(),
		userId: state.userId || undefined,
		sessionId: state.sessionId || getOrCreateSessionId(),
		event: eventName,
		properties: { ...autoProps, ...properties },
	};

	// 异步上报，不阻塞页面
	trackEventFn({ data: payload }).catch((err) => {
		// 埋点失败不影响业务流程
		console.error("[track]", (err as Error).message);
	});
}

let routeTrackingCleanup: (() => void) | null = null;

/** 启动 SPA 路由追踪：仅 pushState / popstate 触发 PageView，replaceState 不触发（非导航） */
export function startRouteTracking(): void {
	if (typeof window === "undefined") return;

	// 避免重复注册（HMR / StrictMode 双重挂载）
	if (routeTrackingCleanup) return;

	const originalPushState = history.pushState;

	history.pushState = function (...args) {
		originalPushState.apply(this, args);
		track("PageView", {});
	};

	const popstateHandler = () => {
		track("PageView", {});
	};

	window.addEventListener("popstate", popstateHandler);

	routeTrackingCleanup = () => {
		history.pushState = originalPushState;
		window.removeEventListener("popstate", popstateHandler);
		routeTrackingCleanup = null;
	};
}

/** 停止路由追踪，恢复浏览器原生 API（useEffect 清理时调用） */
export function stopRouteTracking(): void {
	if (routeTrackingCleanup) {
		routeTrackingCleanup();
	}
}
