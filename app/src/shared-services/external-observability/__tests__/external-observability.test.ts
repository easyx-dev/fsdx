/**
 * 外部系统调用可观测模块测试：pino 日志分级 + Prometheus 指标
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogger, mockInc, mockObserve } = vi.hoisted(() => ({
	mockLogger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	mockInc: vi.fn(),
	mockObserve: vi.fn(),
}));

vi.mock("#/shared-services/logger", () => ({ logger: mockLogger }));
vi.mock("#/shared-services/metrics", () => ({
	externalCallsTotal: { inc: mockInc },
	externalCallDurationSeconds: { observe: mockObserve },
}));

import { logExternalRequest } from "#/shared-services/external-observability";
import { runWithRequestContext } from "#/shared-services/request-context";

describe("logExternalRequest", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("成功调用记 debug 日志并累加 success 指标", () => {
		logExternalRequest({
			system: "external",
			requestType: "login",
			path: "/api/token/",
			duration: 50,
			success: true,
		});

		expect(mockInc).toHaveBeenCalledWith({
			system: "external",
			outcome: "success",
		});
		expect(mockObserve).toHaveBeenCalledWith(0.05, { system: "external" });
		expect(mockLogger.debug).toHaveBeenCalled();
		expect(mockLogger.warn).not.toHaveBeenCalled();
	});

	it("失败调用记 warn 日志并累加 error 指标", () => {
		logExternalRequest({
			system: "integration",
			requestType: "business",
			path: "/rest/data/query",
			duration: 200,
			success: false,
			error: "timeout",
		});

		expect(mockInc).toHaveBeenCalledWith({
			system: "integration",
			outcome: "error",
		});
		expect(mockLogger.warn).toHaveBeenCalled();
		expect(mockLogger.debug).not.toHaveBeenCalled();
	});

	it("ALS 上下文内注入操作者与 requestId", () => {
		runWithRequestContext(
			{
				requestId: "req-1",
				operator: {
					id: "a1",
					username: "张三",
					email: null,
					type: "admin",
				},
			},
			() => {
				logExternalRequest({
					system: "external",
					requestType: "business",
					path: "/api/test",
					duration: 10,
					success: true,
				});
			},
		);

		expect(mockLogger.debug.mock.calls.at(-1)?.[0]).toMatchObject({
			operatorId: "a1",
			operatorName: "张三",
			operatorType: "admin",
			requestId: "req-1",
		});
	});

	it("无 ALS 上下文时操作者兜底为 system", () => {
		logExternalRequest({
			system: "external",
			requestType: "business",
			path: "/api/test",
			duration: 10,
			success: true,
		});

		expect(mockLogger.debug.mock.calls.at(-1)?.[0]).toMatchObject({
			operatorId: null,
			operatorName: null,
			operatorType: "system",
		});
	});

	it("extra 元数据并入日志字段", () => {
		logExternalRequest({
			system: "external",
			requestType: "business",
			path: "/api/test",
			duration: 10,
			success: true,
			extra: { apiCode: "scm" },
		});

		expect(mockLogger.debug.mock.calls.at(-1)?.[0]).toMatchObject({
			apiCode: "scm",
			path: "/api/test",
		});
	});
});
