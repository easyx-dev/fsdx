/**
 * 客户端用户列表（开发中）
 */

import { createFileRoute } from "@tanstack/react-router";
import { Result } from "antd";

export const Route = createFileRoute("/admin/_admin/users/clients/")({
	component: ClientUsersPage,
});

function ClientUsersPage() {
	return <Result status="info" title="客户端用户管理" subTitle="功能开发中" />;
}
