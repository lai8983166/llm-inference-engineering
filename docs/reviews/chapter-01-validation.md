# 第 01 章验证记录

验证环境：Node.js 24.14.1、npm 11.11.0、OpenSpec 1.10.0。执行目录为项目根目录。

## 自动检查

2026-08-23 依次执行：

```text
npm run lint          PASS
npm run typecheck     PASS
npm run check:content PASS — 1 prose-first chapter checked
npm run test          PASS — 6 test files, 17 tests
npm run build         PASS — 32 modules transformed
```

测试覆盖课程入口与章节路由、正文/实践先后顺序、键盘首段焦点顺序、内容结构底线、窄屏 CSS 保护、reduced-motion、四类动态图交互、预测交互，以及取消轨迹中的输出抑制、在途资源和一次性释放不变量。生产构建生成单一入口和静态资源，无构建告警。

## 浏览器验收状态

开发阶段的自动浏览器连接不可用，因此没有把源码检查冒充视觉验收。2026-08-23，项目负责人完成实际页面验收并确认第 01 章整体效果符合预期；此前反馈的深色面板标题对比度问题已修复。结合已有的键盘顺序、窄屏结构和交互测试，OpenSpec 的 1.2 与 4.2 完成。
