/**
 * 元素尺寸 hook：用 ResizeObserver 监听 ref 元素的 content box 尺寸
 */
import { useEffect, useRef, useState } from "react";

export function useElementSize<T extends HTMLElement>(): [
	React.RefObject<T | null>,
	{ width: number; height: number },
] {
	const ref = useRef<T>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) setSize({ width: rect.width, height: rect.height });
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return [ref, size];
}
