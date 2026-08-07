/**
 * 日志下载 API 路由
 */
import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";
import { adminPermRouteGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { getLogRawContent } from "#/services/logs/logs.server";

export const Route = createFileRoute("/api/download/log/$id")({
	server: {
		middleware: [adminPermRouteGuard(ADMIN_PERMISSIONS.LOG_DOWNLOAD)],
		handlers: {
			GET: async ({ params }) => {
				const content = await getLogRawContent(params.id);
				if (!content) {
					return new Response("File not found", { status: 404 });
				}
				const readableStream = Readable.toWeb(Readable.from(content));
				return new Response(readableStream as ReadableStream, {
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Content-Disposition": `attachment; filename="${params.id}.log"`,
					},
				});
			},
		},
	},
});
