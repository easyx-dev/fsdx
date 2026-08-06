/**
 * antd 6 复合组件 JSX 类型修复
 *
 * 背景：antd 6.4.3 的 Card / Image 等复合组件使用
 * `interface X extends typeof 组件`（Card）或 `interface X extends React.FC`（Image）
 * 的方式挂载静态子组件（Card.Meta / Card.Grid / Image.PreviewGroup）。
 * 该写法在 TypeScript 6 + React 19 类型体系下会丢失组件本体的调用签名，
 * 导致 JSX 使用处报 `TS2604/TS2786: cannot be used as a JSX component`。
 *
 * 修复：通过模块增补（module augmentation）将这两个组件重新声明为
 * 「组件本体交叉子组件」的交叉类型，恢复调用签名，对全部调用方透明生效。
 * antd 官方修复此声明缺陷后，本文件可整体删除。
 */
import type InternalCard from "antd/es/card/Card";
import type CardGrid from "antd/es/card/CardGrid";
import type CardMeta from "antd/es/card/CardMeta";
import type PreviewGroup from "antd/es/image/PreviewGroup";
import type { ImageProps } from "antd";
import type * as React from "react";

declare module "antd" {
	/** Card：组件本体（ForwardRefExoticComponent）交叉 Meta/Grid 静态属性 */
	export const Card: typeof InternalCard & {
		Grid: typeof CardGrid;
		Meta: typeof CardMeta;
	};

	/** Image：组件本体（FC<ImageProps>）交叉 PreviewGroup 静态属性 */
	export const Image: React.FC<ImageProps> & {
		PreviewGroup: typeof PreviewGroup;
	};
}
