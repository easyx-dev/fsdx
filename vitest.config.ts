/**
 * Vitest 测试配置
 * 继承 vite.config.ts 的路径别名和插件配置
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // 路径别名通过 vite.config.ts 的 resolve.tsconfigPaths 继承
  },
});
