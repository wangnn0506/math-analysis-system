# 拾题：高中数学错题文档整理

一个面向高中数学教师的 Web MVP。教师维护学生名单，上传试卷 PDF 或 DOCX；对于图片型 Word，系统只定位题号并保留完整原卷，教师可在题号旁直接勾选错题，随后生成保留公式、图形和原版排版的 Word 错题集。

## 已实现功能

- 学生名单：添加、修改和删除学生，保存学号、姓名、班级与备注。
- 试卷上传：支持 500 MB 以内的 PDF 和 DOCX。
- 原卷裁图：图片型 DOCX 自动提取整页图片，只识别题号坐标，不转写题干和数学公式。
- 完整试卷选题：在原卷每个题号旁显示选择按钮，勾选后直接生成学生错题集。
- 题号校正：支持对已上传试卷重新识别，也可在完整页面上删除误标、点击补放漏题标记并保存。
- 自动拆题：文本型文档继续支持 1.、2、和“第3题”等常见主问题号。
- 拆题校正：教师可以修改题号和题目正文、删除误识别题目、补充漏题。
- 错题整理：选择学生和试卷，输入以空格、逗号或顿号分隔的错题号。
- Word 生成：图片题按题号边界裁剪原图，跨页题保留多个连续截图；文本题按原顺序排版。
- 生成历史：保存错题集生成记录并支持重新下载。

## 当前边界

- 当前版本是单教师 MVP，没有登录、权限和多人协作，不应直接暴露到公网。
- 数据保存在 data/db.json，上传文件保存在 data/uploads。
- 不识别或重建数学公式语义，也不做手写识别、答案识别或自动判题。
- 图片型 DOCX 和扫描型 PDF 会提取为整页 PNG；有文字层的 PDF 优先保留文字，无法提取文字时自动转为页面图片识别题号。
- 图片模式只用 OCR 定位题号，并结合题号格式与空间连续关系筛选主问题；不会把 `(i)/(ii)` 等罗马数字小问强制转换成主问题号。题干始终来自原图，因此公式与几何图形不会发生 OCR 乱码。
- 题号定位仍可能受低清晰度、旋转、特殊编号或多栏版式影响，上传后需要教师在完整试卷上核对按钮位置。

## 技术栈

- Next.js 16 App Router
- React 19 + TypeScript
- JSON 文件数据仓库，原子替换写入和进程内写锁
- Mammoth：DOCX 文本提取
- PDF.js + @napi-rs/canvas：PDF 文字提取与扫描页渲染
- Tesseract.js：图片型试卷题号坐标定位
- JSZip / PNG.js：DOCX 页面图片提取与无损裁剪
- docx：Word 错题集生成
- Vitest：规则与文档管线单元测试
- Playwright：真实浏览器主流程验收

## 本地运行

需要 Node.js 20.9 或更高版本，以及 pnpm。

~~~bash
pnpm install
pnpm dev
~~~

浏览器打开 http://localhost:3000。

生产构建：

~~~bash
pnpm build
pnpm start
~~~

可通过 APP_DATA_DIR 环境变量指定数据与上传文件目录；未设置时默认使用项目根目录下的 data。

## 常用检查

~~~bash
pnpm typecheck
pnpm test
pnpm build
~~~

浏览器验收脚本位于 tests/e2e-smoke.mjs，需要提供 PLAYWRIGHT_MODULE 和 BROWSER_EXECUTABLE 环境变量。它会：

1. 添加测试学生。
2. 上传并识别 DOCX。
3. 上传并识别 PDF。
4. 选择学生、试卷和错题号。
5. 下载生成的 DOCX。

## 项目结构

~~~text
src/
├── app/
│   ├── api/
│   │   ├── documents/        # 试卷上传与识别
│   │   └── wrong-books/      # DOCX 生成与重新下载
│   ├── documents/            # 试卷列表、整页预览和题号选择
│   ├── students/             # 学生名单
│   └── wrong-books/          # 错题集生成页面
├── components/               # 通用页面组件
└── lib/
    ├── documents/
    │   ├── extract.ts        # PDF/DOCX 文本或整页图片提取
    │   ├── image-questions.ts # 题号定位与 PNG 裁剪
    │   ├── split.ts          # 题号识别与拆题
    │   └── generate.ts       # DOCX 生成
    ├── store.ts              # JSON 数据仓库
    ├── text.ts               # 题号与文件名处理
    └── types.ts
tests/
├── fixtures/
├── documents.test.ts
├── split.test.ts
└── e2e-smoke.mjs
~~~

## 文档

- [产品需求](docs/PRD.md)
- [系统架构](docs/ARCHITECTURE.md)
- [数据设计](docs/DATABASE.md)

## 建议的下一步

1. 收集 10 至 20 份匿名真实高中数学试卷，补充题号规则和失败样例。
2. 增加题号位置拖动和裁剪边界微调；当前已支持删除误标和点击补点。
3. 增加学生批量导入、班级筛选和错题号批量录入。
4. 增加账号认证、PostgreSQL、对象存储和备份后，再部署为多人 SaaS。
5. 若扫描 PDF 数量显著增长，再独立评估 OCR 服务、识别成本和人工复核流程。
