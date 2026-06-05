/**
 * 邮件发送模块：基于 nodemailer，用于发送验证码等邮件
 */
import { createTransport, type Transporter } from "nodemailer";
import { getEnv } from "#/lib/env";
import { logger } from "#/lib/logger";

/** 邮件发送参数 */
export interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
}

/** 懒加载 transporter */
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
	if (!_transporter) {
		const { SMTP } = getEnv();
		_transporter = createTransport({
			host: SMTP.host,
			port: SMTP.port,
			secure: SMTP.secure,
			auth: {
				user: SMTP.user,
				pass: SMTP.pass,
			},
		});
	}
	return _transporter;
}

/**
 * 发送邮件
 */
export async function sendMail(options: SendMailOptions): Promise<boolean> {
	try {
		const transporter = getTransporter();
		await transporter.sendMail({
			from: getEnv().SMTP.from,
			to: options.to,
			subject: options.subject,
			html: options.html,
		});
		logger.info({ to: options.to, subject: options.subject }, "邮件发送成功");
		return true;
	} catch (err) {
		logger.error(
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
