/**
 * 管理员列表（开发中）
 */

import { createFileRoute } from "@tanstack/react-router";
import { Result } from "antd";

export const Route = createFileRoute("/admin/_admin/users/admins/")({
	component: AdminUsersPage,
});

function AdminUsersPage() {
	return <Result status="info" title="管理员管理" subTitle="功能开发中" />;
}
