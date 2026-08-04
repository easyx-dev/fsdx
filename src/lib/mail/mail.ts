/**
 * 邮件发送模块：基于 nodemailer，SMTP 配置从系统配置表读取
 */
import { createTransport, type Transporter } from "nodemailer";
import { logger } from "#/lib/logger/logger";
import { getConfig as getSystemConfig } from "#/services/config/config.server";

/** 邮件发送参数 */
export interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
}

let _transporter: Transporter | null = null;
let _lastConfigFingerprint = "";

/** 读取系统配置并确保返回纯字符串 */
async function readConfig(key: string): Promise<string> {
	return await getSystemConfig(key);
}

/**
 * 懒加载创建 transporter，配置变更时自动重建
 */
async function getTransporter(): Promise<Transporter | null> {
	const host = await readConfig("smtp_host");
	if (!host) {
		logger.warn("SMTP 未配置（smtp_host 为空），邮件功能不可用");
		return null;
	}

	const port = Number(await readConfig("smtp_port")) || 587;
	const secure = (await readConfig("smtp_secure")) === "true";
	const user = await readConfig("smtp_user");
	const pass = await readConfig("smtp_pass");
	const from = await readConfig("smtp_from");
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
	try {
		const transporter = await getTransporter();
		if (!transporter) {
			logger.warn({ to: options.to }, "邮件发送跳过：SMTP 未配置");
			return false;
		}

		const from = (await readConfig("smtp_from")) || "noreply@example.com";
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
