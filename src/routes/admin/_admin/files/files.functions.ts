/**
 * 文件管理 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { deleteFile, makePermanent } from "#/server/file/file.server";
import { logOperation } from "#/server/operation-log/operation-log.server";

const idSchema = z.object({ id: z.string().min(1) });

export const deleteFileSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		await deleteFile(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "file",
			action: "delete",
			targetType: "file",
			targetId: data.id,
		});
		return { success: true };
	});

export const makePermanentSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EDIT)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		await makePermanent(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "file",
			action: "make_permanent",
			targetType: "file",
			targetId: data.id,
		});
		return { success: true };
	});
