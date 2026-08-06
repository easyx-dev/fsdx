/**
 * 资源管理器：文件下载路由（catch-all 路径参数）
 * URL: /api/download/file-explorer/*
 */
import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";
import { adminPermRouteGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { createFileReadStream } from "#/services/file-explorer/file-explorer.server";

export const Route = createFileRoute("/api/download/file-explorer/$")({
	server: {
		middleware: [adminPermRouteGuard(ADMIN_PERMISSIONS.FILE_EXPLORER_VIEW)],
		handlers: {
			GET: async ({ params }) => {
				try {
					const subPath = decodeURIComponent(params._splat ?? "");
					const { stream, name } = await createFileReadStream(subPath);
					const readableStream = Readable.toWeb(stream);
					return new Response(readableStream as ReadableStream, {
						headers: {
							"Content-Type": "application/octet-stream",
							"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
						},
					});
				} catch (err) {
					const e = err as NodeJS.ErrnoException;
					const status = e.code === "ENOENT" ? 404 : 500;
					return new Response(JSON.stringify({ error: e.message }), {
						status,
						headers: { "Content-Type": "application/json" },
					});
				}
			},
		},
	},
});
