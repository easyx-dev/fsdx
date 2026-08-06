/**
 * antd 6 复合组件 JSX 类型修复（ui-spa 包内自检用）
 *
 * 与 app/src/types/antd-fix.d.ts 同源：antd 6.4.3 的 Image 使用
 * `interface CompositionImage extends React.FC` 挂载 PreviewGroup 静态属性，
 * 在 TypeScript 6 + React 19 下丢失调用签名（TS2604/TS2786）。
 * ui-spa 独立执行 tsc 时不经过 app 的类型增补，故需在包内重复声明。
 * antd 官方修复后，本文件可整体删除。
 */
import type { ImageProps } from "antd";
import type PreviewGroup from "antd/es/image/PreviewGroup";
import type * as React from "react";

declare module "antd" {
	/** Image：组件本体（FC<ImageProps>）交叉 PreviewGroup 静态属性 */
	export const Image: React.FC<ImageProps> & {
		PreviewGroup: typeof PreviewGroup;
	};
}
