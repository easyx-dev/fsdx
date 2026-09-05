/**
 * 预置系统配置常量：仅服务端启动时自动插入的配置项（纯数据，无副作用）
 * 由 config.server.ts 的 ensurePresetConfigs 消费，保证预置项幂等可控
 */
import type { EditorType } from "#/constants/editor-types";

/** 预置系统配置常量类型 */
export interface PresetConfig {
	key: string;
	value: string;
	description: string;
	clientVisible: boolean;
	valueType: EditorType;
	groupName: string;
}

/** 预置系统配置常量（仅服务端启动时自动插入的配置项） */
export const PRESET_CONFIGS: PresetConfig[] = [
	{
		key: "site_name",
		value: "FSDX",
		description: "站点名称",
		clientVisible: true,
		valueType: "input",
		groupName: "站点设置",
	},
	{
		key: "keywords",
		value: "",
		description: "SEO head 关键词",
		clientVisible: true,
		valueType: "text",
		groupName: "站点设置",
	},
	{
		key: "description",
		value: "",
		description: "SEO head 站点描述",
		clientVisible: true,
		valueType: "text",
		groupName: "站点设置",
	},
	{
		key: "company_address",
		value: "",
		description: "公司地址",
		clientVisible: true,
		valueType: "text",
		groupName: "站点设置",
	},
	{
		key: "company_tell",
		value: "",
		description: "公司电话",
		clientVisible: true,
		valueType: "input",
		groupName: "站点设置",
	},
	{
		key: "company_email",
		value: "",
		description: "公司邮箱",
		clientVisible: true,
		valueType: "input",
		groupName: "站点设置",
	},
	{
		key: "smtp_host",
		value: "",
		description: "SMTP 服务器地址",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_port",
		value: "",
		description: "SMTP 端口",
		clientVisible: false,
		valueType: "number",
		groupName: "邮件设置",
	},
	{
		key: "smtp_secure",
		value: "false",
		description: "是否使用 SSL/TLS",
		clientVisible: false,
		valueType: "boolean",
		groupName: "邮件设置",
	},
	{
		key: "smtp_user",
		value: "",
		description: "SMTP 用户名",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_pass",
		value: "",
		description: "SMTP 密码",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_from",
		value: "",
		description: "发件人邮箱地址",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "ai_providers",
		value: "{}",
		description:
			"AI 厂商配置（对象 JSON）：{ [厂商id]: { name, baseUrl, apiKey, default?, models: { [模型名]: { name?, default?, contextLimit?, outputLimit?, jsonOutput?, toolCalls?, reasoning?, input?, output? } } } }，底层走 OpenAI 兼容协议",
		clientVisible: false,
		valueType: "json",
		groupName: "AI设置",
	},
	{
		key: "ai_translation_prompt",
		value:
			"你是一名专业的{targetLang}母语译者，需要将{sourceLang}文本流畅自然地翻译成{targetLang}。\n\n## 翻译规则\n1. 仅输出翻译后的内容，不要添加任何解释或额外说明\n2. 翻译必须保持与原文完全相同的段落数量和格式结构\n3. 如果文本包含 HTML 标签，请在保持语义通顺的前提下，将标签放置在翻译中的合适位置\n4. 对于不应翻译的内容（如专有名词、代码等），保留原文不做翻译\n\n## 待翻译内容\n{sourceText}",
		description:
			"AI 翻译提示词模板，支持占位符 {sourceLang}、{targetLang}、{sourceText}",
		clientVisible: false,
		valueType: "text",
		groupName: "AI设置",
	},
	{
		key: "sms_provider",
		value: "",
		description: "短信服务商（aliyun = 阿里云，留空禁用）",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_access_key_id",
		value: "",
		description: "阿里云 AccessKey ID",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_access_key_secret",
		value: "",
		description: "阿里云 AccessKey Secret",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_sign_name",
		value: "",
		description: "阿里云短信签名",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_template_code",
		value: "",
		description: "阿里云短信模板码",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "custom_head_config",
		value: "{}",
		description:
			"自定义 head 配置（JSON，结构同 TanStack head()：{ meta, links, scripts, styles }，如百度统计、JSON-LD），全局生效于前台 SSR 页面。注意：该配置由管理员填写并原样注入页面，拥有配置编辑权限即等价于可执行公共站点任意脚本",
		clientVisible: true,
		valueType: "json",
		groupName: "站点设置",
	},
];
