# 系统架构：拾题 Web MVP

## 1. 当前架构

系统采用单进程 Next.js 模块化单体，面向单教师本地或可信内网运行。

~~~mermaid
flowchart LR
    T["教师浏览器"] -->|"页面与表单"| N["Next.js Web 应用"]
    N --> S["JSON 数据仓库"]
    N --> U["本地上传目录"]
    N --> X["PDF.js / Mammoth / JSZip"]
    N --> O["Tesseract.js 题号定位"]
    N --> P["PNG 原图裁剪"]
    N --> W["DOCX 生成器"]
    W --> T
~~~

没有外部数据库、认证服务、云端 OCR、AI 模型或云存储依赖。图片题号定位使用随应用安装的本地 Tesseract.js 中文模型。

## 2. 模块边界

### 页面层

- app/page.tsx：工作台。
- app/students：学生名单和 Server Actions。
- app/documents：试卷列表、上传入口和拆题预览。
- app/wrong-books：错题集生成和历史。

### HTTP 接口

- POST /api/documents：接收文件、提取文本、拆题、保存。
- GET /api/documents/:id/pages/:page：读取图片型试卷的原始页面 PNG。
- POST /api/documents/:id/reprocess：读取已保存页面并用当前规则重新定位题号。
- PUT /api/documents/:id/questions：保存教师在原卷页面上校正后的题号锚点，并重建裁剪区域。
- POST /api/wrong-books：校验题号、生成 DOCX、记录历史。
- GET /api/wrong-books/:id：根据历史记录重新生成 DOCX。

### 领域与基础设施

- lib/documents/extract.ts：PDF/DOCX 转统一纯文本，或从扫描 PDF / 图片型 DOCX 提取整页 PNG。
- lib/documents/image-questions.ts：定位题号坐标、建立跨页裁剪区域并无损裁剪 PNG。
- lib/documents/split.ts：从统一文本识别主问题号。
- lib/documents/generate.ts：生成 Word 文档。
- lib/store.ts：读取和原子更新 JSON 数据。
- lib/text.ts：题号规范化、输入解析和安全文件名。

## 3. 文档处理流程

~~~mermaid
sequenceDiagram
    actor Teacher as 教师
    participant API as 上传接口
    participant Extract as 文本提取
    participant Split as 题号识别
    participant Store as 数据仓库

    Teacher->>API: 上传 PDF / DOCX
    API->>API: 校验类型和 500 MB 上限
    API->>Extract: 提取文本或整页图片
    alt 图片型 DOCX
        Extract-->>API: 原始页面 PNG
        API->>Split: OCR 仅定位连续题号坐标
        Split-->>API: 锚点与跨页裁剪区域
    else 文本型文档
        Extract-->>API: 文本与警告
        API->>Split: 规则识别主问题号
        Split-->>API: 题目片段与警告
    end
    API->>Store: 保存试卷和题目
    API-->>Teacher: 跳转拆题预览
~~~

PDF 有文字层时读取每页文字项的坐标，以纵坐标分组为行、横坐标排序为行内顺序；没有文字层时使用 PDF.js 和 @napi-rs/canvas 渲染为页面 PNG，再进入图片题号定位。普通 DOCX 使用 Mammoth 提取段落纯文本；图片型 DOCX 则由 JSZip 按文档关系顺序提取页面，使用左侧题号区域 OCR，再通过题号格式、候选置信度和跨页连续关系确认编号。

## 4. 错题集生成流程

1. 服务端读取学生和试卷，不能信任客户端提交的题目正文。
2. 统一解析错题号并去重。
3. 检查每个题号是否存在；任一缺失时整体失败。
4. 按试卷中的 order 排序选中题目。
5. 文本题按固定版式生成；图片题根据 cropRegions 从原始页面无损裁剪并作为内联 PNG 写入 DOCX。
6. 成功生成后记录 studentId、documentId、标题和题号。
7. 通过下载响应返回浏览器。

## 5. 题号识别策略

文本识别器只处理行首主问题号：

- 阿拉伯数字 + 点、顿号或右括号。
- “第 + 阿拉伯数字 + 题”。

以下内容不启动新主问题：

- “一、选择题”等章节标题。
- “（1）（2）”等小问。
- 行中间出现的数字。

图片识别器把明确的行首题号和二次识别候选分为不同可信级别，再结合 1、2、3……的空间连续顺序选择锚点。针对 Tesseract 将 `11` 误读为 `1L` 等情况，只对题号首 token 做有限纠正；数字限定 OCR 不再拥有独立提名权，因此 `(i)/(ii)` 不会被强制解释为主问题号。OCR 文字会被丢弃，题目内容永远来自原图。

教师校正时，客户端只提交题号与页面坐标；服务端重新校验范围、去重、排序，并依据相邻锚点重建所有 `cropRegions`。已上传页面本身不会被修改。

## 6. 数据一致性

JSON 数据库使用以下策略：

- 写入前完整读取当前文件。
- 在内存中应用变更。
- 写入同目录随机临时文件。
- 使用 rename 原子替换 db.json。
- 全局 Promise 队列保证单进程内写操作串行。

这能防止常见的半写文件，但不支持多进程或多实例并发。production 启动时只能运行一个应用实例。

## 7. 文件安全

- 只接受 .pdf 和 .docx。
- 限制单文件 500 MB；Next.js 代理请求缓冲上限配置为 512 MB，预留 multipart 元数据空间。
- 原始文件使用 UUID 内部文件名。
- 不使用原始文件名拼接存储路径。
- 下载文件名移除系统非法字符。
- 文档内容不进入应用日志。

当前没有身份验证，所以安全边界是本机或可信内网。若需要公网部署，认证与授权是前置条件。

## 8. DOCX 版式

采用紧凑练习资料风格：

- Letter 纵向。
- 四边 1 英寸页边距。
- 正文 11 pt、1.25 倍行距。
- 蓝色 16 pt 题目标题。
- 题目之间有浅灰分隔线。
- 页脚显示产品说明和当前页码。

生成器对文本题保留换行和 PDF 页码标记；对图片题使用高分辨率内联 PNG，不尝试重建公式对象，因此不会产生公式字符乱码。

## 9. 缓存与动态渲染

所有读取本地数据的页面使用 force-dynamic，确保添加学生、上传试卷或生成错题集后刷新即可看到最新 JSON 数据。上传和下载 Route Handler 不缓存。

## 10. 测试

### 单元测试

- 常见题号识别。
- 小问不被拆分。
- 重复题号警告。
- 无题号全文回退。
- 错题号输入规范化。
- DOCX 提取与拆题。
- 生成结果是有效 OOXML ZIP。
- 图片型 DOCX 页面提取与 PNG 裁剪尺寸。

### 浏览器验收

tests/e2e-smoke.mjs 使用真实浏览器验证：

- 学生添加。
- DOCX 上传和三道题识别。
- PDF 上传和两道题识别。
- 错题号 1、3 的 Word 下载。
- 真实 4 页图片型数学试卷的 1–19 题连续定位、整页按钮预览和跨页裁图下载。
- 真实 44 页题目合集的 1–44 题连续定位，并验证罗马数字小问不会抢占第 4 题。

## 11. 迁移到多人 SaaS

多人版本不应继续扩展 JSON 仓库。建议按以下顺序迁移：

1. 引入教师认证和资源归属。
2. 将 Store 接口实现替换为 PostgreSQL。
3. 上传文件迁移到兼容 S3 的对象存储。
4. 为每个查询和写操作增加 tenantId。
5. 增加备份、恢复、审计和限流。
6. 文档解析耗时达到请求上限后再引入任务队列。

页面、提取、拆题和 DOCX 生成模块可以继续复用。
