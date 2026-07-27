/**
 * 邮箱验证码组件：验证码输入 + 获取验证码按钮（弹窗图片验证码）
 * 点击获取验证码时弹出模态框展示图片验证码，错误信息在模态框内显示
 */

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	getImageCaptchaSFn,
	sendCaptchaWithImageVerificationSFn,
} from "#/server/captcha/captcha.functions";

interface CaptchaInputProps {
	/** 邮箱地址 */
	email: string;
	/** 邮箱验证码值 */
	value: string;
	/** 邮箱验证码变化回调 */
	onChange: (value: string) => void;
	/** 消息回调 */
	onMessage: (msg: string) => void;
}

export function CaptchaInput({
	email,
	value,
	onChange,
	onMessage,
}: CaptchaInputProps) {
	const [svg, setSvg] = useState("");
	const [imageToken, setImageToken] = useState("");
	const [imageCode, setImageCode] = useState("");
	const [isLoadingSvg, setIsLoadingSvg] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [modalError, setModalError] = useState("");

	// 模态框状态：mounted 控制 DOM 存在，visible 控制动画
	const [modalMounted, setModalMounted] = useState(false);
	const [modalVisible, setModalVisible] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);

	/** 刷新图片验证码 */
	const refresh = useCallback(() => {
		setIsLoadingSvg(true);
		setModalError("");
		getImageCaptchaSFn()
			.then((result) => {
				setSvg(result.svg);
				setImageToken(result.token);
				setImageCode("");
				setIsLoadingSvg(false);
			})
			.catch(() => {
				setIsLoadingSvg(false);
				toast.error("验证码加载失败，请稍后重试");
			});
	}, []);

	/** 打开模态框 */
	const openModal = useCallback(() => {
		setModalError("");
		setModalMounted(true);
		requestAnimationFrame(() => {
			setModalVisible(true);
		});
		refresh();
	}, [refresh]);

	/** 关闭模态框 */
	const closeModal = useCallback(() => {
		setModalVisible(false);
		setTimeout(() => setModalMounted(false), 200);
	}, []);

	// 模态框打开时自动聚焦输入框
	useEffect(() => {
		if (modalVisible && imageInputRef.current) {
			imageInputRef.current.focus();
		}
	}, [modalVisible]);

	// Esc 键关闭模态框
	useEffect(() => {
		if (!modalVisible) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeModal();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [modalVisible, closeModal]);

	// 模态框打开时锁定 body 滚动
	useEffect(() => {
		if (!modalMounted) return;
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = overflow;
		};
	}, [modalMounted]);

	/** 确定：校验图片验证码并发送邮箱验证码 */
	const handleConfirm = useCallback(async () => {
		if (!email) {
			setModalError("请先输入邮箱");
			return;
		}
		if (!imageCode) {
			setModalError("请输入图片验证码");
			return;
		}
		setModalError("");
		setIsSending(true);
		onMessage("验证中...");
		try {
			const result = await sendCaptchaWithImageVerificationSFn({
				data: { email, imageToken, imageCode },
			});
			if (result.success) {
				onMessage(result.message);
				closeModal();
			} else {
				setModalError(result.message);
				refresh();
			}
		} catch {
			setModalError("请求失败");
			refresh();
		} finally {
			setIsSending(false);
		}
	}, [email, imageToken, imageCode, onMessage, refresh, closeModal]);

	/** 在图片验证码输入框中按 Enter 直接提交 */
	const handleImageKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleConfirm();
			}
		},
		[handleConfirm],
	);

	return (
		<>
			{/* 邮箱验证码输入 + 获取验证码按钮 */}
			<div className="flex gap-2">
				<Input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="邮箱验证码"
					maxLength={6}
					className="flex-1"
					autoComplete="off"
					aria-label="邮箱验证码"
				/>
				<Button
					type="button"
					variant="outline"
					className="shrink-0"
					disabled={isSending}
					onClick={openModal}
				>
					{isSending ? "发送中..." : "获取验证码"}
				</Button>
			</div>

			{/* 图片验证码模态框 */}
			{modalMounted && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center transition-colors duration-200"
					style={{
						backgroundColor: modalVisible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
					}}
					onClick={closeModal}
				>
					<div
						className="relative mx-4 w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg transition-all duration-200"
						style={{
							opacity: modalVisible ? 1 : 0,
							transform: modalVisible ? "scale(1)" : "scale(0.95)",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="mb-4 text-center text-sm font-medium">
							请输入图片验证码
						</h3>

						{/* 错误信息 */}
						{modalError ? (
							<div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
								{modalError}
							</div>
						) : null}

						<div className="mb-4 flex items-center gap-2">
							<div
								className="flex h-10 w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-background"
								onClick={refresh}
								title="点击刷新图片验证码"
								dangerouslySetInnerHTML={{ __html: svg }}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-9 w-9 shrink-0"
								disabled={isLoadingSvg}
								onClick={refresh}
								title="刷新图片验证码"
							>
								<RefreshCw
									className={`h-4 w-4 ${isLoadingSvg ? "animate-spin" : ""}`}
								/>
							</Button>
							<Input
								ref={imageInputRef}
								type="text"
								value={imageCode}
								onChange={(e) => setImageCode(e.target.value)}
								onKeyDown={handleImageKeyDown}
								placeholder="图片验证码"
								maxLength={4}
								className="flex-1"
								autoComplete="off"
								aria-label="图片验证码"
							/>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								className="flex-1"
								disabled={!imageCode || isSending}
								onClick={handleConfirm}
							>
								{isSending ? "验证中..." : "确定"}
							</Button>
							<Button
								type="button"
								variant="outline"
								className="flex-1"
								disabled={isSending}
								onClick={closeModal}
							>
								取消
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
