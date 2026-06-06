/**
 * 文件管理页面：上传、列表、下载、删除、秒传
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Check, Download, FolderOpen, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	deleteFile,
	getFileList as getFileListService,
	makePermanent,
	uploadFile,
} from "#/server/file";

const fileListSchema = z.object({ status: z.string().optional() });
const idSchema = z.object({ id: z.string().min(1) });

const getFileList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.FILE_VIEW)])
	.inputValidator(fileListSchema)
	.handler(async ({ data }) => {
		return getFileListService(data.status);
	});

const deleteFileFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.FILE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data }) => {
		await deleteFile(data.id);
		return { success: true };
	});

const makePermanentFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.FILE_EDIT)])
	.inputValidator(idSchema)
	.handler(async ({ data }) => {
		await makePermanent(data.id);
		return { success: true };
	});

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string | null): string {
	if (!d) return "—";
	return new Date(d).toLocaleString("zh-CN");
}

export const Route = createFileRoute("/admin/_admin/files/")({
	component: FilesPage,
	loader: async () => await getFileList({ data: {} }),
});

function FilesPage() {
	const router = useRouter();
	const initialFiles = Route.useLoaderData();
	const [files, setFiles] = useState(initialFiles);
	const [filter, setFilter] = useState("");
	const [uploading, setUploading] = useState(false);
	const [uploadMsg, setUploadMsg] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const refreshFiles = async () => {
		const data = await getFileList({ data: { status: filter || undefined } });
		setFiles(data);
	};

	const handleFilterChange = async (status: string) => {
		setFilter(status);
		const data = await getFileList({ data: { status: status || undefined } });
		setFiles(data);
	};

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (!selectedFile) return;
		setUploading(true);
		setUploadMsg("");
		try {
			const fd = new FormData();
			fd.append("file", selectedFile);
			const result = await uploadFile({ data: fd });
			if (result.success) {
				setUploadMsg(
					result.data.isDuplicated ? "秒传成功（文件已存在）" : "上传成功",
				);
				await refreshFiles();
				await router.invalidate();
			} else {
				setUploadMsg("上传失败");
			}
		} catch (err) {
			console.error("[文件上传失败]", err);
			setUploadMsg("上传失败: 网络错误");
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	return (
		<AdminShell>
			<div>
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-zinc-900">文件管理</h1>
					<label className="flex cursor-pointer items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
						<Upload size={16} />
						{uploading ? "上传中..." : "上传文件"}
						<input
							ref={fileInputRef}
							type="file"
							className="hidden"
							onChange={handleUpload}
							disabled={uploading}
						/>
					</label>
				</div>
				{uploadMsg && (
					<div
						className={`mt-3 rounded-md px-4 py-2 text-sm ${uploadMsg.includes("失败") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
					>
						{uploadMsg}
					</div>
				)}
				<div className="mt-4 flex gap-2">
					{["", "temp", "permanent"].map((s) => (
						<button
							key={s}
							onClick={() => handleFilterChange(s)}
							className={`rounded-md px-3 py-1 text-xs font-medium ${filter === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
						>
							{s === "" ? "全部" : s === "temp" ? "临时" : "永久"}
						</button>
					))}
				</div>
				<div className="mt-4 rounded-lg border border-zinc-200 bg-white">
					<table className="w-full">
						<thead>
							<tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
								<th className="px-4 py-3 font-medium">文件名</th>
								<th className="px-4 py-3 font-medium">大小</th>
								<th className="px-4 py-3 font-medium">状态</th>
								<th className="px-4 py-3 font-medium">上传时间</th>
								<th className="px-4 py-3 font-medium w-28">操作</th>
							</tr>
						</thead>
						<tbody>
							{files.length === 0 && (
								<tr>
									<td
										colSpan={5}
										className="px-4 py-12 text-center text-sm text-zinc-400"
									>
										<FolderOpen
											size={32}
											className="mx-auto mb-2 text-zinc-300"
										/>
										暂无文件
									</td>
								</tr>
							)}
							{files.map((f) => (
								<tr key={f.id} className="border-b border-zinc-50 text-sm">
									<td className="px-4 py-3">
										<div className="max-w-xs truncate font-medium text-zinc-800">
											{f.originalName}
										</div>
									</td>
									<td className="px-4 py-3 text-zinc-500">
										{formatSize(f.size)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-block rounded-full px-2 py-0.5 text-xs ${f.status === "permanent" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}
										>
											{f.status === "permanent" ? "永久" : "临时"}
										</span>
									</td>
									<td className="px-4 py-3 text-zinc-400 text-xs">
										{formatDate(f.createdAt)}
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-1">
											<Download size={14} className="text-zinc-300" />
											{f.status === "temp" && (
												<button
													onClick={async () => {
														await makePermanentFn({ data: { id: f.id } });
														await refreshFiles();
													}}
													className="rounded p-1 text-zinc-400 hover:bg-green-50 hover:text-green-600"
													title="转为永久"
												>
													<Check size={14} />
												</button>
											)}
											<button
												onClick={async () => {
													if (!confirm("确定删除？")) return;
													await deleteFileFn({ data: { id: f.id } });
													await refreshFiles();
												}}
												className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
												title="删除"
											>
												<Trash2 size={14} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</AdminShell>
	);
}
