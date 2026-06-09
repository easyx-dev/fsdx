/**
 * 字段翻译抽屉组件：在实体表格中为字段提供国际化翻译编辑入口
 */
import { GlobalOutlined } from "@ant-design/icons";
import { Button, Card, Drawer, message, Tabs } from "antd";
import { useCallback, useEffect, useState } from "react";
import { TypeAwareEditor } from "#/components/admin/TypeAwareEditor";
import type { EditorType } from "#/lib/editor-types/editor-types";
import {
	DEFAULT_LOCALE,
	type Locale,
	SUPPORTED_LOCALES,
} from "#/lib/i18n/i18n.types";
import {
	getFieldTranslationsFn,
	saveContentTranslationFn,
} from "#/server/i18n/i18n.functions";

/** 可翻译字段定义 */
export interface TranslatableField {
	name: string;
	label: string;
	valueType: EditorType;
}

interface Props {
	entityType: string;
	entityId: string;
	fields: TranslatableField[];
	activeField?: string;
	/** 各字段在原表中的当前值（默认语言展示用） */
	originalValues?: Record<string, string>;
	/** 触发方式：图标按钮或文字按钮 */
	trigger?: "icon" | "button";
}

/** 语言对应中文标签 */
const LOCALE_LABELS: Record<string, string> = {
	zh: "中文（默认）",
	en: "English",
};

/** 字段翻译抽屉组件 */
export function FieldTranslationDrawer({
	entityType,
	entityId,
	fields,
	activeField,
	originalValues,
	trigger = "icon",
}: Props) {
	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState(
		activeField ?? fields[0]?.name ?? "",
	);
	const [translations, setTranslations] = useState<
		Record<string, Record<string, string>>
	>({});
	const [saving, setSaving] = useState<string | null>(null);

	const loadTranslations = useCallback(
		async (fieldName: string) => {
			try {
				const result = await getFieldTranslationsFn({
					data: { entityType, entityId, fieldName },
				});
				const vals: Record<string, string> = {};
				for (const l of Object.keys(result)) {
					vals[l] = result[l].value;
				}
				setTranslations((prev) => ({ ...prev, [fieldName]: vals }));
			} catch (err: unknown) {
				message.error(
					`加载翻译失败: ${err instanceof Error ? err.message : "未知错误"}`,
				);
			}
		},
		[entityType, entityId],
	);

	// 打开抽屉时加载当前字段的所有翻译
	useEffect(() => {
		if (!open) return;
		loadTranslations(activeTab);
	}, [open, activeTab, loadTranslations]);

	async function saveTranslation(fieldName: string, locale: Locale) {
		const value = translations[fieldName]?.[locale];
		if (!value) return;

		const field = fields.find((f) => f.name === fieldName);
		const key = `${fieldName}:${locale}`;
		setSaving(key);
		try {
			await saveContentTranslationFn({
				data: {
					entityType,
					entityId,
					fieldName,
					locale,
					value,
					valueType: field?.valueType ?? "text",
				},
			});
			message.success(
				`${field?.label ?? fieldName} ${locale.toUpperCase()} 翻译已保存`,
			);
		} catch (err: unknown) {
			message.error(
				`保存失败: ${err instanceof Error ? err.message : "未知错误"}`,
			);
		} finally {
			setSaving(null);
		}
	}

	function updateValue(fieldName: string, locale: string, val: string) {
		setTranslations((prev) => ({
			...prev,
			[fieldName]: { ...(prev[fieldName] ?? {}), [locale]: val },
		}));
	}

	// 根据触发方式渲染触发器
	const triggerEl =
		trigger === "icon" ? (
			<GlobalOutlined
				className="cursor-pointer text-muted-foreground hover:text-primary ml-1"
				onClick={(e) => {
					e.stopPropagation();
					setOpen(true);
				}}
			/>
		) : (
			<Button
				type="link"
				size="small"
				icon={<GlobalOutlined />}
				onClick={() => setOpen(true)}
			>
				翻译
			</Button>
		);

	return (
		<>
			{triggerEl}
			<Drawer
				title={`字段翻译 — ${entityType}`}
				open={open}
				onClose={() => setOpen(false)}
				size={680}
				styles={{
					body: {
						paddingTop: 0,
					},
				}}
			>
				<Tabs
					activeKey={activeTab}
					onChange={(key) => {
						setActiveTab(key);
						if (!translations[key]) loadTranslations(key);
					}}
					items={fields.map((field) => ({
						key: field.name,
						label: field.label,
						children: (
							<div className="space-y-4">
								{SUPPORTED_LOCALES.map((locale) => {
									const isDefault = locale === DEFAULT_LOCALE;
									const value = isDefault
										? (originalValues?.[field.name] ?? "")
										: (translations[field.name]?.[locale] ?? "");
									const saveKey = `${field.name}:${locale}`;

									return (
										<Card
											key={locale}
											size="small"
											type="inner"
											title={LOCALE_LABELS[locale] ?? locale.toUpperCase()}
											styles={{ root: { marginBottom: 20 } }}
											extra={
												isDefault ? (
													<span className="text-xs text-muted-foreground">
														从主表读取
													</span>
												) : (
													<Button
														type="primary"
														size="small"
														loading={saving === saveKey}
														onClick={() => saveTranslation(field.name, locale)}
													>
														保存
													</Button>
												)
											}
										>
											<TypeAwareEditor
												value={value}
												onChange={(val) =>
													updateValue(field.name, locale, String(val ?? ""))
												}
												type={field.valueType}
												preview={isDefault}
											/>
										</Card>
									);
								})}
							</div>
						),
					}))}
				/>
			</Drawer>
		</>
	);
}
