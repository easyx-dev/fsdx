/**
 * 图片验证码弹窗（基础组件）：SVG 验证码展示 + 刷新 + 验证码输入 + 确认
 * 验证码获取与校验经回调注入，由宿主决定数据来源；错误提示经 onError 转发
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "../ui";

/** 获取图片验证码回调，返回 SVG 与一次性的校验 token */
export type GetCaptchaFn = () => Promise<{ svg: string; token: string }>;

/** 校验图片验证码回调，返回成功与否及提示信息 */
export type VerifyCaptchaFn = (
	token: string,
	code: string,
) => Promise<{ success: boolean; message: string }>;

interface ImageCaptchaModalProps {
	/** 弹窗是否可见 */
	open: boolean;
	/** 关闭弹窗回调 */
	onClose: () => void;
	/** 获取图片验证码回调（宿主注入，如对接 getImageCaptchaSFn） */
	getCaptcha: GetCaptchaFn;
	/** 校验图片验证码回调（宿主注入，如对接 sendCaptchaWithImageVerificationSFn） */
	verify: VerifyCaptchaFn;
	/** 弹窗外错误提示回调（如验证码加载失败，宿主据此 toast） */
	onError?: (message: string) => void;
	/** 状态消息回调（如发送成功提示，宿主据此更新表单提示） */
	onMessage?: (message: string) => void;
}

/** 内置刷新图标（SVG），避免依赖图标库 */
function RefreshIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M21 2v6h-6" />
			<path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
			<path d="M3 22v-6h6" />
			<path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
		</svg>
	);
}

export function ImageCaptchaModal({
	open,
	onClose,
	getCaptcha,
	verify,
	onError,
	onMessage,
}: ImageCaptchaModalProps) {
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
	// 关闭动画定时器：重新打开前须清理，避免旧定时器卸载新弹窗
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** 刷新图片验证码 */
	const refresh = useCallback(() => {
		setIsLoadingSvg(true);
		setModalError("");
		getCaptcha()
			.then((result) => {
				setSvg(result.svg);
				setImageToken(result.token);
				setImageCode("");
				setIsLoadingSvg(false);
			})
			.catch(() => {
				setIsLoadingSvg(false);
				onError?.("验证码加载失败，请稍后重试");
			});
	}, [getCaptcha, onError]);

	/** 打开模态框 */
	const openModal = useCallback(() => {
		setModalError("");
		setModalMounted(true);
		requestAnimationFrame(() => {
			setModalVisible(true);
		});
		refresh();
	}, [refresh]);

	// 以 ref 持有最新 openModal，open 副作用只依赖 open，避免父级重渲染触发重复刷新
	const openModalRef = useRef(openModal);
	openModalRef.current = openModal;

	/** 关闭模态框 */
	const closeModal = useCallback(() => {
		setModalVisible(false);
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		closeTimerRef.current = setTimeout(() => {
			setModalMounted(false);
			closeTimerRef.current = null;
		}, 200);
		onClose();
	}, [onClose]);

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

	// open 变为 true 时启动打开流程；通过 ref 调用最新实现，父级重渲染不触发重复刷新
	useEffect(() => {
		if (open) {
			openModalRef.current();
		}
	}, [open]);

	// 组件卸载时清理关闭动画定时器
	useEffect(() => {
		return () => {
			if (closeTimerRef.current) {
				clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	/** 确定：校验图片验证码 */
	const handleConfirm = useCallback(async () => {
		if (!imageCode) {
			setModalError("请输入图片验证码");
			return;
		}
		setModalError("");
		setIsSending(true);
		onMessage?.("验证中...");
		try {
			const result = await verify(imageToken, imageCode);
			if (result.success) {
				onMessage?.(result.message);
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
	}, [imageToken, imageCode, verify, onMessage, refresh, closeModal]);

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
								<RefreshIcon
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
