/**
 * 客户端消息中心页面（SSR）
 * 列表分页展示消息，支持标记已读/删除
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { getCurrentClientSFn } from "#/services/client-auth/client-auth.functions";
import {
	deleteMyMessageSFn,
	getMyMessagesSFn,
	getMyUnreadCountSFn,
	markAllMyMessagesAsReadSFn,
	markMyMessageAsReadSFn,
} from "#/services/message/message.functions";
import type { MessageRecord } from "#/services/message/message.server";

export const Route = createFileRoute("/messages/")({
	beforeLoad: async () => {
		const user = await getCurrentClientSFn();
		if (!user) throw redirect({ to: "/login" });
	},
	loader: async () => {
		const [result, unread] = await Promise.all([
			getMyMessagesSFn({ data: { page: 1 } }),
			getMyUnreadCountSFn(),
		]);
		return { result, unread };
	},
	component: MessagesPage,
});

const PAGE_SIZE = 10;

/** 消息类型图标与颜色映射 */
const TYPE_META: Record<string, { badge: string; label: string }> = {
	ppt: { badge: "bg-blue-500", label: "报表" },
	task: { badge: "bg-orange-500", label: "任务" },
	system: { badge: "bg-neutral-400", label: "系统" },
};

function MessagesPage() {
	const initial = Route.useLoaderData();
	const [records, setRecords] = useState<MessageRecord[]>(
		initial.result.records,
	);
	const [page, setPage] = useState(initial.result.page);
	const [total, setTotal] = useState(initial.result.total);
	const [unread, setUnread] = useState(initial.unread);
	const [status, setStatus] = useState<"all" | "unread" | "read">("all");
	const [loading, setLoading] = useState(false);

	/** 拉取消息列表 */
	const load = useCallback(async (p: number, s: typeof status) => {
		setLoading(true);
		try {
			const result = await getMyMessagesSFn({
				data: {
					page: p,
					pageSize: PAGE_SIZE,
					status: s === "all" ? undefined : s,
				},
			});
			setRecords(result.records);
			setPage(result.page);
			setTotal(result.total);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "加载消息失败");
		} finally {
			setLoading(false);
		}
	}, []);

	/** 刷新未读数 */
	const refreshUnread = useCallback(async () => {
		try {
			setUnread(await getMyUnreadCountSFn());
		} catch {
			// 未读数获取失败不阻塞操作
		}
	}, []);

	/** 标记单条已读 */
	const handleMarkRead = async (id: string) => {
		try {
			await markMyMessageAsReadSFn({ data: { id } });
			setRecords((prev) =>
				prev.map((r) => (r.id === id ? { ...r, status: "read" } : r)),
			);
			await refreshUnread();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	/** 全部标记已读 */
	const handleMarkAllRead = async () => {
		try {
			await markAllMyMessagesAsReadSFn();
			setRecords((prev) => prev.map((r) => ({ ...r, status: "read" })));
			await refreshUnread();
			toast.success("已全部标记为已读");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	/** 删除消息 */
	const handleDelete = async (id: string) => {
		try {
			const { success } = await deleteMyMessageSFn({ data: { id } });
			if (success) {
				setRecords((prev) => prev.filter((r) => r.id !== id));
				setTotal((t: number) => Math.max(0, t - 1));
				await refreshUnread();
				toast.success("已删除");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "删除失败");
		}
	};

	return (
		<main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
			<header className="mb-6 flex items-center justify-between sm:mb-8">
				<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					消息中心
				</h1>
				{unread > 0 && (
					<Button variant="outline" size="sm" onClick={handleMarkAllRead}>
						全部已读
					</Button>
				)}
			</header>

			{/* 状态筛选 */}
			<div className="mb-4 flex items-center gap-2">
				{(["all", "unread", "read"] as const).map((s) => (
					<Button
						key={s}
						variant={status === s ? "default" : "outline"}
						size="sm"
						onClick={() => {
							setStatus(s);
							void load(1, s);
						}}
					>
						{s === "all" && "全部"}
						{s === "unread" && `未读${unread > 0 ? ` (${unread})` : ""}`}
						{s === "read" && "已读"}
					</Button>
				))}
			</div>

			{/* 消息列表 */}
			<div className="space-y-3">
				{records.map((msg) => {
					const meta = TYPE_META[msg.type] ?? TYPE_META.system;
					return (
						<Card
							key={msg.id}
							className={msg.status === "unread" ? "border-primary/60" : ""}
						>
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between gap-3">
									<CardTitle className="flex items-center gap-2 text-base">
										{msg.status === "unread" && (
											<span
												className={`h-2 w-2 shrink-0 rounded-full ${meta.badge}`}
											/>
										)}
										<span className="truncate">{msg.title}</span>
									</CardTitle>
									<Badge variant="secondary" className="shrink-0 text-xs">
										{meta.label}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="pt-2">
								{msg.content && (
									<p className="text-sm whitespace-pre-wrap text-muted-foreground">
										{msg.content}
									</p>
								)}
								<div className="mt-3 flex items-center justify-between gap-3">
									<time className="text-xs text-muted-foreground">
										{new Date(msg.createdAt).toLocaleString("zh-CN")}
									</time>
									<div className="flex items-center gap-2">
										{msg.status === "unread" && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => void handleMarkRead(msg.id)}
											>
												已读
											</Button>
										)}
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive hover:text-destructive"
											onClick={() => void handleDelete(msg.id)}
										>
											删除
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
				{records.length === 0 && !loading && (
					<div className="py-16 text-center text-sm text-muted-foreground">
						暂无消息
					</div>
				)}
			</div>

			{/* 分页 */}
			{total > PAGE_SIZE && (
				<div className="mt-6 flex items-center justify-center gap-3">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1 || loading}
						onClick={() => void load(page - 1, status)}
					>
						上一页
					</Button>
					<span className="text-sm text-muted-foreground">
						{page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
						onClick={() => void load(page + 1, status)}
					>
						下一页
					</Button>
				</div>
			)}
		</main>
	);
}
