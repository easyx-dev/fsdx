/**
 * antd 静态方法桥接壳：re-export @fsdx/ui-spa/antd-static
 * 保持 #/components/antd-static 引用路径不变，避免各页面大量改动
 */
export {
	AntdStaticBridge,
	message,
	modal,
	notification,
} from "@fsdx/ui-spa/antd-static";
