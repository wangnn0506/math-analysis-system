# 数据设计：单教师 JSON 仓库

## 1. 存储位置

默认数据目录为项目根目录下的 data：

~~~text
data/
├── db.json
└── uploads/
    ├── <uuid>.pdf
    ├── <uuid>.docx
    └── <uuid>-page-<n>.png
~~~

可使用 APP_DATA_DIR 指定其他绝对或相对目录。data 已加入 .gitignore，学生数据和上传试卷不会进入 Git。

## 2. 数据库顶层结构

~~~json
{
  "version": 1,
  "students": [],
  "documents": [],
  "questions": [],
  "wrongBooks": []
}
~~~

version 用于未来进行显式数据迁移。应用遇到未知版本时拒绝启动写操作，不能猜测结构。

## 3. 实体关系

~~~mermaid
erDiagram
    STUDENT ||--o{ WRONG_BOOK : owns
    SOURCE_DOCUMENT ||--o{ QUESTION : contains
    SOURCE_DOCUMENT ||--o{ WRONG_BOOK : selected_from
~~~

## 4. Student

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| id | UUID 字符串 | 主键 |
| studentNo | string | 必填；当前数据文件内唯一 |
| name | string | 必填 |
| className | string | 可空字符串 |
| notes | string | 可空字符串 |
| createdAt | ISO 时间 | 创建时间 |
| updatedAt | ISO 时间 | 修改时间 |

删除学生前检查 wrongBooks 是否引用该学生。有历史记录时拒绝删除，避免生成历史失去归属。

## 5. SourceDocument

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| id | UUID 字符串 | 主键 |
| title | string | 试卷展示名称 |
| originalFilename | string | 原始文件名，仅展示 |
| mimeType | string | 浏览器提交的 MIME，不能作为唯一安全判断 |
| filePath | string | UUID 文件的服务端路径 |
| processingMode | text / page-images | 文本拆题或整页图片裁题 |
| pages | DocumentPage[] | 图片模式的页面路径、像素宽度和高度 |
| status | READY / FAILED | 当前只持久化成功文档 |
| questionCount | integer | questions 数量缓存 |
| extractionWarnings | string[] | 识别后需教师核对的信息 |
| createdAt | ISO 时间 | 创建时间 |
| updatedAt | ISO 时间 | 修改时间 |

删除试卷前检查 wrongBooks 引用。有历史时拒绝删除；成功删除记录后再尽力删除上传文件。

## 6. Question

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| id | UUID 字符串 | 主键 |
| documentId | UUID 字符串 | 指向 SourceDocument |
| number | string | 同一文档内唯一，可为 1、12、1-2、全文 |
| content | string | 文本题正文；图片题为说明文字，不用于输出题干 |
| anchor | QuestionAnchor，可选 | 题号所在 pageIndex、x、y 像素坐标 |
| cropRegions | QuestionCropRegion[]，可选 | 该题在一个或多个页面中的裁剪矩形 |
| order | integer | 试卷顺序，从 1 开始 |
| createdAt | ISO 时间 | 创建时间 |
| updatedAt | ISO 时间 | 修改时间 |

生成错题集时始终按 order 排序。删除题目会同步减少 SourceDocument.questionCount。

图片题号重新识别或教师校正时，服务端会先验证题号唯一性及坐标范围，再以页面顺序整体替换该试卷的 Question 记录，同时重新计算全部 cropRegions、order、questionCount 和 SourceDocument.updatedAt。原始页面 PNG 不会改变。

## 7. WrongBook

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| id | UUID 字符串 | 主键 |
| studentId | UUID 字符串 | 指向 Student |
| documentId | UUID 字符串 | 指向 SourceDocument |
| title | string | DOCX 标题和下载文件名来源 |
| questionNumbers | string[] | 生成时选择的题号，已按试卷顺序 |
| createdAt | ISO 时间 | 生成时间 |

不保存 DOCX 二进制。重新下载时按当前学生、试卷和题目记录重新生成；图片题会重新读取页面 PNG 并应用保存的裁剪区域。

如果产品需要“历史文档永远不变”，下一版本应增加问题内容快照或保存生成文件。

## 8. 写入流程

~~~mermaid
sequenceDiagram
    participant Request as 写请求
    participant Queue as 进程内写队列
    participant Store as Store
    participant Disk as 文件系统

    Request->>Queue: 等待前一个写操作
    Queue->>Store: 读取 db.json
    Store->>Store: 验证并修改内存对象
    Store->>Disk: 写随机 .tmp 文件
    Store->>Disk: rename 替换 db.json
    Store-->>Queue: 释放下一个写操作
~~~

如果 mutator 抛错，不写临时数据库。rename 之前进程中断时，旧 db.json 保持完整；遗留临时文件不会被读取。

## 9. 不变量

- version 必须为 1。
- student.studentNo 唯一。
- question.number 在 documentId 范围内唯一。
- document.questionCount 等于所属 questions 数量。
- wrongBook 的 studentId 和 documentId 必须存在。
- wrongBook.questionNumbers 在创建时必须全部存在。

JSON 文件无法自行执行外键或唯一约束，全部由 Store 的写方法集中保证。

## 10. 保留与备份

- 上传原文件、页面 PNG 和 db.json 必须作为一个整体备份。
- 不要只备份 db.json，否则无法重新处理原试卷。
- 删除 data 会删除全部学生、试卷和生成历史，开发验收数据除外不得自动清理。
- 正式教师使用时建议每天复制 data 到受控备份目录。

## 11. 容量边界

当前仓库每次写入都读取并重写完整 db.json，适合：

- 单教师。
- 数百名学生。
- 数百份试卷。
- 数万道题以内的早期试用。

出现多人并发、多进程部署、文件达到几十 MB 或写入延迟明显时，应迁移 PostgreSQL，不应继续给 JSON 文件增加锁和索引模拟。

## 12. PostgreSQL 迁移映射

| JSON 集合 | PostgreSQL 表 |
| --- | --- |
| students | students |
| documents | source_documents |
| questions | questions |
| wrongBooks | wrong_books + wrong_book_questions |

迁移时用 UUID 原值作为主键；questionNumbers 应改为关联 questionId 的明细表，避免题号修改影响历史关系。
