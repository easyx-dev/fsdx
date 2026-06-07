/**
 * 文件下载 API 路由
 */
import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";
import { readFileContent } from "#/server/file/file.server";

export const Route = createFileRoute("/api/download/file/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const result = await readFileContent(params.id);
				if (!result) {
					return new Response("File not found", { status: 404 });
				}
				const readableStream = Readable.toWeb(Readable.from(result.buffer));
				return new Response(readableStream as ReadableStream, {
					headers: {
						"Content-Type": result.record.mimeType,
						"Content-Disposition": `inline; filename="${encodeURIComponent(result.record.originalName)}"`,
						// "Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			},
		},
	},
});
