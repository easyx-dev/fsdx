/**
 * 角色管理（开发中）
 */

import { createFileRoute } from "@tanstack/react-router";
import { Result } from "antd";

export const Route = createFileRoute("/admin/_admin/roles/")({
	component: RolesPage,
});

function RolesPage() {
	return <Result status="info" title="角色管理" subTitle="功能开发中" />;
}
