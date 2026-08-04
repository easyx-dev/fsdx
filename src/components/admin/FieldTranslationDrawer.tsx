/**
 * 字段翻译抽屉组件：在实体表格中为字段提供国际化翻译编辑入口
 */
import { RobotOutlined, TranslationOutlined } from "@ant-design/icons";
import { Button, Card, Drawer, Tabs, Tooltip } from "antd";
import { useCallback, useEffect, useId, useState } from "react";
import { EditorTypes } from "#/components/admin/editor-type";
import { message } from "#/components/antd-static";
import type { EditorType } from "#/constants/editor-types";
import {
	DEFAULT_LOCALE,
	type Locale,
	SUPPORTED_LOCALES,
} from "#/lib/i18n/i18n.types";
import {
	aiTranslateFieldSFn,
	getFieldTranslationsSFn,
	saveContentTranslationSFn,
} from "#/services/i18n/i18n.functions";

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
}: Props) {
	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState(
		activeField ?? fields[0]?.name ?? "",
	);
	const [translations, setTranslations] = useState<
		Record<string, Record<string, string>>
	>({});
	const [saving, setSaving] = useState<string | null>(null);
	const [aiTranslating, setAiTranslating] = useState<string | null>(null);

	const loadTranslations = useCallback(
		async (fieldName: string) => {
			try {
				const result = await getFieldTranslationsSFn({
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
			await saveContentTranslationSFn({
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

	async function handleAiTranslate(fieldName: string, targetLocale: string) {
		const sourceText = originalValues?.[fieldName];
		if (!sourceText?.trim()) {
			message.warning("源文本为空，无法翻译");
			return;
		}

		const key = `${fieldName}:${targetLocale}`;
		setAiTranslating(key);
		try {
			const translated = await aiTranslateFieldSFn({
				data: {
					sourceText,
					targetLang: LOCALE_LABELS[targetLocale] ?? targetLocale,
					sourceLang: LOCALE_LABELS[DEFAULT_LOCALE] ?? DEFAULT_LOCALE,
				},
			});
			if (translated) {
				updateValue(fieldName, targetLocale, translated);
			}
		} catch (err: unknown) {
			message.error(
				`AI 翻译失败: ${err instanceof Error ? err.message : "未知错误"}`,
			);
		} finally {
			setAiTranslating(null);
		}
	}

	function updateValue(fieldName: string, locale: string, val: string) {
		setTranslations((prev) => ({
			...prev,
			[fieldName]: { ...(prev[fieldName] ?? {}), [locale]: val },
		}));
	}

	// 根据触发方式渲染触发器
	const gradientId = `i18n-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

	const triggerEl = (
		<Tooltip title="国际化">
			<Button
				type="link"
				size="small"
				icon={
					<TranslationOutlined
						style={{ cursor: "pointer" }}
						className={`hover:opacity-80 ml-1 ${gradientId}`}
						onClick={(e) => {
							e.stopPropagation();
							setOpen(true);
						}}
					/>
				}
			></Button>
		</Tooltip>
	);

	return (
		<>
			<svg width="0" height="0" aria-hidden="true">
				<defs>
					<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#667eea" />
						<stop offset="100%" stopColor="#764ba2" />
					</linearGradient>
				</defs>
			</svg>
			<style>{`
				.${gradientId}.anticon svg {
					fill: url(#${gradientId});
				}
			`}</style>
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
											title={
												isDefault ? (
													(LOCALE_LABELS[locale] ?? locale.toUpperCase())
												) : (
													<span className="flex items-center gap-2">
														{LOCALE_LABELS[locale] ?? locale.toUpperCase()}
														<Button
															type="link"
															size="small"
															icon={
																<RobotOutlined style={{ color: "#a855f7" }} />
															}
															loading={aiTranslating === saveKey}
															disabled={!originalValues?.[field.name]?.trim()}
															className="font-medium"
															style={{
																background:
																	"linear-gradient(to right, #a855f7, #c084fc, #e879f9, #ec4899)",
																backgroundClip: "text",
																WebkitBackgroundClip: "text",
																WebkitTextFillColor: "transparent",
															}}
															onClick={() =>
																handleAiTranslate(field.name, locale)
															}
														>
															AI 翻译
														</Button>
													</span>
												)
											}
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
											<EditorTypes.Editor
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
