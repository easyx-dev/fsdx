/**
 * 发布状态快筛：管理端列表页统一的三态筛选（全部 / 已上架 / 未上架）
 * 上架状态在单元格内直接切换（PublishSwitchCell），此处只负责筛选。
 */
import { Segmented } from "antd";

/** 筛选值（空串表示全部） */
export type PublishedFilterValue = "" | "published" | "unpublished";

/** 默认选项文案 */
const OPTIONS = [
	{ label: "全部", value: "" },
	{ label: "已上架", value: "published" },
	{ label: "未上架", value: "unpublished" },
];

/** 发布语义用词（新闻等模块用「已发布 / 未发布」） */
export interface PublishedLabels {
	published: string;
	unpublished: string;
}

interface PublishedFilterProps {
	value: PublishedFilterValue;
	onChange: (value: PublishedFilterValue) => void;
	labels?: PublishedLabels;
}

/** 将发布语义文案替换进默认选项 */
function toOptions(labels?: PublishedLabels) {
	const published = labels?.published ?? "已上架";
	const unpublished = labels?.unpublished ?? "未上架";
	return OPTIONS.map((option) =>
		option.value === "published"
			? { ...option, label: published }
			: option.value === "unpublished"
				? { ...option, label: unpublished }
				: option,
	);
}

export function PublishedFilter({
	value,
	onChange,
	labels,
}: PublishedFilterProps) {
	return (
		<Segmented
			options={toOptions(labels)}
			value={value}
			onChange={(next) => onChange(next as PublishedFilterValue)}
		/>
	);
}

/** 将筛选值转为 isPublished 查询参数（空串 → undefined 表示不筛选） */
export function toIsPublished(
	value: PublishedFilterValue,
): boolean | undefined {
	if (value === "published") return true;
	if (value === "unpublished") return false;
	return undefined;
}
