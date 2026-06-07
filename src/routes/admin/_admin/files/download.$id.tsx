/**
 * 文件下载路由 — 根据文件 ID 返回文件内容
 * loader 返回 Response 对象，跳过组件渲染
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readFileContent } from "#/server/file/file.server";

const getFileData = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data: { id } }) => {
		const result = await readFileContent(id);
		if (!result) return null;
		return {
			bufferBase64: result.buffer.toString("base64"),
			mimeType: result.record.mimeType,
			originalName: result.record.originalName,
		};
	});

export const Route = createFileRoute("/admin/_admin/files/download/$id")({
	loader: async ({ params }) => {
		const data = await getFileData({ data: { id: params.id } });
		if (!data) return new Response("Not Found", { status: 404 });
		const buffer = Buffer.from(data.bufferBase64, "base64");
		return new Response(buffer, {
			headers: {
				"Content-Type": data.mimeType,
				"Content-Disposition": `inline; filename="${encodeURIComponent(data.originalName)}"`,
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	},
});
