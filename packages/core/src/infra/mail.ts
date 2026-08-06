/**
 * 邮件发送模块：基于 nodemailer，SMTP 配置经 initMail 注入的 getConfig 回调读取
 * 未 init 直接调用时抛错（fail-fast），配置变更时自动重建 transporter
 */
import { createTransport, type Transporter } from "nodemailer";
import type { Logger } from "./logger";

/** 邮件发送参数 */
export interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
}

/** 邮件模块依赖注入 */
export interface MailDeps {
	/** 系统配置读取回调（smtp_* 键） */
	getConfig: (key: string) => Promise<string>;
	/** 日志实例 */
	logger: Logger;
}

let _deps: MailDeps | null = null;
let _transporter: Transporter | null = null;
let _lastConfigFingerprint = "";

/**
 * 注入邮件模块依赖，bootstrap 启动时调用
 */
export function initMail(deps: MailDeps): void {
	_deps = deps;
}

/** 测试专用：重置注入状态与缓存的 transporter */
export function resetMailForTest(): void {
	_deps = null;
	_transporter = null;
	_lastConfigFingerprint = "";
}

/** 获取依赖，未注入时抛错（fail-fast） */
function assertDeps(): MailDeps {
	if (!_deps) {
		throw new Error("邮件模块未初始化，请先调用 initMail()");
	}
	return _deps;
}

/**
 * 懒加载创建 transporter，配置变更时自动重建
 */
async function getTransporter(): Promise<Transporter | null> {
	const { getConfig, logger } = assertDeps();
	const host = await getConfig("smtp_host");
	if (!host) {
		logger.warn("SMTP 未配置（smtp_host 为空），邮件功能不可用");
		return null;
	}

	const port = Number(await getConfig("smtp_port")) || 587;
	const secure = (await getConfig("smtp_secure")) === "true";
	const user = await getConfig("smtp_user");
	const pass = await getConfig("smtp_pass");
	const from = await getConfig("smtp_from");
	const fingerprint = [host, port, secure, user, pass, from].join("|");

	if (_transporter && _lastConfigFingerprint === fingerprint) {
		return _transporter;
	}

	_transporter = createTransport({
		host,
		port,
		secure,
		auth: user ? { user, pass } : undefined,
	});
	_lastConfigFingerprint = fingerprint;
	return _transporter;
}

/**
 * 发送邮件
 */
export async function sendMail(options: SendMailOptions): Promise<boolean> {
	const { getConfig, logger } = assertDeps();
	try {
		const transporter = await getTransporter();
		if (!transporter) {
			logger.warn({ to: options.to }, "邮件发送跳过：SMTP 未配置");
			return false;
		}

		const from = (await getConfig("smtp_from")) || "noreply@example.com";
		await transporter.sendMail({
			from,
			to: options.to,
			subject: options.subject,
			html: options.html,
		});
		logger.info({ to: options.to, subject: options.subject }, "邮件发送成功");
		return true;
	} catch (err) {
		logger.warn(
			{ to: options.to, error: (err as Error).message },
			"邮件发送失败",
		);
		return false;
	}
}

/**
 * 发送验证码邮件
 */
export async function sendCaptchaMail(
	to: string,
	code: string,
): Promise<boolean> {
	const html = `
     <div style="max-width: 480px; margin: 0 auto; padding: 32px; font-family: sans-serif; background: #f9fafb; border-radius: 8px;">
       <h2 style="color: #1f2937; margin-top: 0;">验证码</h2>
       <p style="color: #6b7280;">您的验证码是：</p>
       <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #111827; background: #fff; padding: 12px 24px; border-radius: 6px; display: inline-block; margin: 12px 0;">
         ${code}
       </div>
       <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">有效期 5 分钟，请勿向他人泄露。</p>
     </div>
   `;
	return sendMail({
		to,
		subject: "验证码",
		html,
	});
}
