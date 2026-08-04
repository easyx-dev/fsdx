/**
 * 日志下载 API 路由
 */
import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { ApiAuthError, verifyAdminPerm } from "#/middleware/api-auth";
import { getLogRawContent } from "#/services/logs/logs.server";

export const Route = createFileRoute("/api/download/log/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					await verifyAdminPerm(PERMISSIONS.LOG_DOWNLOAD);
				} catch (err) {
					if (err instanceof ApiAuthError) {
						return new Response(JSON.stringify({ error: err.message }), {
							status: err.statusCode,
							headers: { "Content-Type": "application/json" },
						});
					}
					throw err;
				}

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
