# 错题通

面向高中数学教师的本地学情分析与教学辅助 Demo。教师可管理班级、学生与家长绑定。试卷与成绩的目标流程是导入 Word、人工审核、按考试生成 Excel 成绩模板、预览并确认成绩，再查看班级和个人学情。演示使用自编试题和虚拟学生。

## 本机启动

双击 [启动演示.command](启动演示.command)，或在项目根目录运行：

```bash
.venv/bin/python scripts/dev.py
```

打开 [教师工作台](http://127.0.0.1:5173/) 或直接进入 [班级管理](http://127.0.0.1:5173/#classes)。在班级管理中使用本地演示账号 `teacher` 登录，密码为 `MathDemo2026!`。后端另有绑定示例学生 `DEMO001` 的演示家长账号 `parent`，密码相同。当前教师工作台没有家长入口。已有本地数据库升级到此版本时，请在数据库运行后从项目根目录执行 `.venv/bin/python backend/manage.py migrate core`，以创建专题草稿、发布记录和英文内容字段。

启动器使用本机已有的 Python 虚拟环境、前端依赖和 Apple Silicon PostgreSQL。若默认 Node 路径不可用，可运行 `MATH_NODE="$(command -v node)" .venv/bin/python scripts/dev.py`。迁移到其他机器时需重新建立 Python、Node 与 PostgreSQL 环境，从依赖锁文件安装依赖，并按 [Django 配置](backend/config/settings.py) 准备本地密钥、数据库及迁移。

Vite、Django 和 PostgreSQL 分别使用本机端口 `5173`、`8000` 和 `55432`。按 Ctrl+C 停止启动器创建的 Web 进程，数据库继续运行。需要单独停止数据库时运行 `local/postgres/native/bin/pg_ctl -D local/pgdata -m fast stop`。请保留 `local/pgdata`，它存放持久化数据。

## 当前可用功能

| 范围 | 当前状态 |
| --- | --- |
| 教师工作台 | 六个主入口已显示。首页统计、图表和待办为虚拟演示数据。 |
| 班级管理 | 已连接真实本地接口。支持教师登录、班级创建、学生新增和筛选、个人考试记录，以及为一个学生绑定或解绑多个家长。 |
| 试卷、考试与学情 | 后端已提供基础 Word 拆题、人工审核冻结、考试名单快照、动态成绩模板、校验预览、确认写入及学情分析。新版考试试卷已接入上传、拆题、知识点建议、人工审核和冻结。成绩导入及班级学情仍待接入新版页面。 |
| 题库管理 | 已接入公开练习专题。教师可从自己的已确认试卷选题，保存、预览、发布或下线中英文专题。 |
| 练习任务与家长端 | 新版练习任务入口仍为占位页。后端支持家长按绑定查看孩子学情，家长微信小程序待实现。 |

旧版界面“知序”曾用于验收试卷与成绩闭环，其入口已退役。本机如保留历史备份，可在 `local/backups/new-ui-classes-20261024/` 查阅。

## 体验试卷审核

1. 教师登录后，打开 [考试试卷](http://127.0.0.1:5173/#exams)，下载三题样卷并上传。
2. 对照原卷检查题号、题型、分值和知识点。可以修改题干、插入题块或移除多余题块。存在拆题提示时，核对原卷后勾选确认。
3. 逐题勾选已核对，保存草稿，再确认冻结。已确认试卷可查看及下载原卷。

## 体验公开练习专题

1. 教师完成一份自编试卷的审核后，进入 [题库管理](http://127.0.0.1:5173/#questions)，新建专题，填写标题、简介和固定的公开地址标识，从一份已确认试卷选题并保存草稿。
2. 打开草稿预览，核对题目适合公开且没有学生个人信息后发布。未登录访客可通过 `/practice-topics/<标识>/` 查看发布版，草稿预览仅专题创建者可访问。
3. 保存新草稿后，公开链接继续显示上次发布的内容。发布新版会更新同一个链接，下线后链接返回 404，草稿可继续编辑。

在专题表单展开「英文版」，填写英文标题、简介和各选中题目的英文题干。填写英文内容后，需补齐标题和全部已选题干才能发布。中文地址保留为 `/practice-topics/<标识>/`，英文使用 `/en/practice-topics/<标识>/`。页面可切换语言，发布记录只包含公开标题、简介、题型和题干。

Django 直接输出带语言标识、页面描述、canonical 和 hreflang 的 HTML。`/sitemap.xml` 只列出已发布的语言版本。包含 LaTeX 的题干按需加载本地 KaTeX 资源，支持 `$…$`、`$$…$$`、`\(…\)`、`\[…\]`。部署时可用 `MATH_PUBLIC_BASE_URL` 设置索引用的站点域名，反向代理需把公开页面、草稿预览、`/topic-assets/` 和 `/sitemap.xml` 转发至 Django。KaTeX 静态资源来自前端已锁定的依赖。

本机可用以下命令重建自编双语演示。命令默认只建草稿，加 `--publish` 可直接发布这份固定演示，已有同名内容会保留。

```bash
.venv/bin/python backend/manage.py seed_bilingual_topic --publish
```

启动后打开 [集合运算入门](http://127.0.0.1:5173/practice-topics/demo-sets-and-intersections/) 或 [Sets and Intersections](http://127.0.0.1:5173/en/practice-topics/demo-sets-and-intersections/)。

## 知识点建议与评估

试卷审核中可逐题获取规则建议。教师可以采用建议后再增删标签，仍需逐题勾选「已核对本题」才能确认试卷。模型不可用时，规则和手动审核仍可继续。

如需启用真实模型，在 Django 进程环境中配置 `OPENAI_API_KEY` 和 `MATH_AI_MODEL`。仅在教师明确确认后发送当前自编题干，模型通过只读工具获取知识点编码和名称，服务端校验输出。接入协议见 [OpenAI Docs](https://developers.openai.com/api/docs/guides/function-calling)。

```bash
.venv/bin/python backend/manage.py evaluate_review
```

评估使用 8 道人工标注的自编题。默认本地规则实测完全匹配 7/8，按标注需修订 1/8，失败样例为题干缺少常见关键词的二次函数问题。命令列出逐题结果和失败请求数。显式加 `--model` 可用已配置的模型评估同一批题，两种结果分别统计。真实模型的在线质量和教师实际修改率需要单独采样。

## 业务规则

1. **试卷审核。** 使用 `.docx`，题数和分值随试卷变化。草稿可调整题号、题型、题干、小问、分值和知识点，人工核对后冻结。复杂自动编号、表格、图片和 Word 公式需要人工核对，目前保留原卷并提供相关提示。
2. **考试与成绩。** 考试保存学生名单快照，使用该考试专用 Excel 模板。逐题成绩须为有限非负数且不超过满分。空白表示未录入，数字 `0` 是有效零分，缺考单独标记且不得同时填写成绩。重复学生、身份不匹配或模板错误会阻止提交。
3. **导入确认。** 先校验预览，再确认入库。覆盖已有成绩需明确确认，重复提交和过期预览受版本校验约束。系统保留导入批次，撤销流程待设计。
4. **统计口径。** 完整成绩才参与班级总分平均与分布。逐题和知识点统计使用已录入的非缺考数据。一题有多个知识点时，得分与满分按标签等分，再计算累计有效得分除以对应满分。有效分母为零时显示无数据。考试难度尚未校准，趋势供教学参考。
5. **权限与数据。** 教师按所属班级、试卷和考试授权，家长按服务端绑定关系访问学生数据，原卷下载也需授权。密钥、数据库和上传文件保存在本地并排除在 Git 之外。真实学生数据上传和外部 AI 数据流转需明确授权。

后续工作包括把考试创建、成绩导入和学情分析接入新版页面，用实际试卷验证复杂 Word 结构，扩展知识点树、历史标签快照和自定义权重，再推进练习任务、题库检索、PDF 组卷及家长小程序。小程序拟采用 Taro，微信真机与小程序端公式渲染仍待验证。借鉴外部项目时需分别核验源码、题库及商用许可。当前环境用于本地演示，生产部署与运维尚待验证。

## 项目结构与接口

- [frontend/src](frontend/src) 使用 React、TypeScript、Vite、Tailwind CSS、Recharts 和 KaTeX 相关依赖。新版入口为 [Dashboard.tsx](frontend/src/Dashboard.tsx)，班级管理位于 [ClassManager.tsx](frontend/src/ClassManager.tsx)。
- [backend/config](backend/config) 提供 Django 配置和路由，[backend/core](backend/core) 提供模型、迁移、DRF 接口和测试。Word 处理在 [documents.py](backend/core/documents.py)，考试与导入在 [workflow.py](backend/core/workflow.py)，统计在 [analysis.py](backend/core/analysis.py)。持久化使用 PostgreSQL，Excel 读写使用 openpyxl。
- 依赖版本见 [Python 锁文件](backend/requirements.lock.txt) 和 [前端锁文件](frontend/pnpm-lock.yaml)。

接口统一使用 `/api/v1/`。完整路径和参数见 [路由定义](backend/config/urls.py)。

| 接口 | 用途 |
| --- | --- |
| `auth/csrf/`、`auth/login/`、`auth/logout/`、`auth/me/` | Session 登录与 CSRF |
| `classrooms/`、`students/`、`parents/`、`parent/children/` | 班级、学生和家长绑定 |
| `papers/`、`papers/{id}/confirm/`、`papers/{id}/source/` | 试卷草稿、审核冻结与原卷下载 |
| `papers/{id}/question-suggestion/` | 知识点建议能力与逐题建议 |
| `exams/`、`exams/{id}/template/`、`exams/{id}/score-imports/` | 考试、成绩模板与导入预览 |
| `score-imports/{id}/commit/` | 确认成绩导入 |
| `exams/{id}/analysis/`、`students/{id}/analysis/` | 班级和个人学情 |
| `overview/`、`knowledge/`、`demo/paper/` | 概览、示例知识点与自编试卷 |
| `topics/`、`topics/{id}/`、`papers/{id}/topic-questions/` | 专题草稿与试卷选题 |
| `topics/{id}/publish/`、`topics/{id}/unpublish/` | 发布指定草稿版本或下线 |

## 测试与验收

在项目根目录运行。后端测试需要可连接、且允许创建测试数据库的 PostgreSQL。

```bash
.venv/bin/python backend/manage.py check
.venv/bin/python backend/manage.py test core
pnpm --dir frontend build
```

- **2026-10-23**，历史 M1/M2 验收验证了本地持久化、角色隔离，以及旧版界面中的三题试卷和逐题成绩闭环。20 名虚拟学生中，18 人成绩完整、1 人部分未录入、1 人缺考。班级平均得分率为 52.22%。
- **2026-10-24**，新版班级管理通过浏览器验收，覆盖教师登录、创建班级和学生、刷新后数据保留、创建家长及绑定和解绑。
- **2026-11-18**，重构后 31 项后端测试在独立的临时 PostgreSQL 上通过，前端类型检查和生产构建通过。Vite 仍有包体积提示，当次未复验浏览器交互。

- **最新验收**覆盖 42 项后端测试和 Playwright 的上传、模型异常时继续人工审核、双语发布、公式渲染、匿名访问及下线流程。GitHub Actions 已配置同一套检查。

浏览器测试使用独立的临时 PostgreSQL 数据库和上传目录。运行前先构建前端，再安装 Chromium。已有 Chrome 时，也可用 `MATH_BROWSER_CHANNEL=chrome` 运行。

```bash
pnpm --dir frontend exec playwright install chromium
.venv/bin/python scripts/test_browser.py
```

### 性能实测

| 指标 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 教师工作台入口 JS，Vite 构建 gzip 大小 | 191.69 KB | 73.92 KB |
| 同一公开样题的 KaTeX 脚本、样式与字体，Chrome 冷加载响应体积 | 343,089 字节 | 124,626 字节 |

工作台按页面懒加载，图表库随首页加载。公开页只在题干含 LaTeX 时请求公式资产，并对公式资产启用 gzip。浏览器测试会输出本机冷加载的 HTML 和公式资源体积。
