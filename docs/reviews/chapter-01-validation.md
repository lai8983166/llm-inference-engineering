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

本轮尝试连接本地 `http://localhost:5173/`，浏览器运行时返回可用浏览器列表为空。因此没有生成桌面/移动截图，也没有把源码检查冒充视觉验收。OpenSpec 的 1.2 与 4.2 保持未完成；连接浏览器后仍需实际检查窄屏表格/代码横向滚动、焦点可见性、目录跳转和实践控件。
