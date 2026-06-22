/**
 * 统一 Logo 组件，管理端和前台共用
 * 管理端 type="admin"：填充六边形 F 图标
 * 前台 type="ssr"：描边六边形 F 图标
 */
interface LogoProps {
	type: "admin" | "ssr";
	height?: number;
}

export function Logo({ type, height = 36 }: LogoProps) {
	const src = type === "admin" ? "/logo-admin.svg" : "/logo.svg";

	return (
		<img
			src={src}
			alt="FSDX"
			height={height}
			className="h-auto"
			style={{ height }}
		/>
	);
}
