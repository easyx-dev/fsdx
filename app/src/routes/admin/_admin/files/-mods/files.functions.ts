/**
 * 文件管理 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { deleteFile, makePermanent } from "#/services/file/file.server";
import { logCrud } from "#/services/operation-log/operation-log.server";

export const idSchema = z.object({ id: z.string().min(1) });

export const deleteFileSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.FILE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		await deleteFile(data.id);
		logCrud(context.user, "file", "delete", { id: data.id });
		return { success: true };
	});

export const makePermanentSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.FILE_EDIT)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		await makePermanent(data.id);
		logCrud(context.user, "file", "make_permanent", { id: data.id });
		return { success: true };
	});
