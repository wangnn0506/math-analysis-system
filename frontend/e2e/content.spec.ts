import { test, expect } from '@playwright/test';

test('review, publish a bilingual topic, then take it offline', async ({
  page,
  browser,
}, testInfo) => {
  const origin = testInfo.project.use.baseURL!;
  const anonymous = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  try {
    const visitor = await anonymous.newPage();
    await page.route('**/question-suggestion/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { model_available: true } });
      } else if (route.request().postDataJSON().allow_external) {
        await route.fulfill({
          status: 503,
          json: { detail: '模型建议暂不可用。可重试或继续手动审核。' },
        });
      } else {
        await route.continue();
      }
    });
    await page.goto('/#exams');
    await page.getByRole('link', { name: '前往班级管理' }).click();
    await page.getByLabel('教师账号').fill('teacher');
    await page.getByLabel('密码', { exact: true }).fill('MathDemo2026!');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByText('本地服务已连接')).toBeVisible();
    await page.getByRole('button', { name: '考试试卷', exact: true }).click();

    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: '下载三题样卷' }).click();
    const sample = testInfo.outputPath('自编样卷.docx');
    await (await download).saveAs(sample);
    await page.locator('input[type=file]').setInputFiles(sample);
    await page.getByRole('button', { name: '上传并拆题' }).click();
    const questions = page
      .locator('.paper-fields .card')
      .filter({ has: page.getByRole('heading', { name: /题块/ }) });
    await expect(questions).toHaveCount(3);

    const first = questions.first();
    page.once('dialog', (dialog) => dialog.accept());
    await first.getByRole('button', { name: '获取模型建议' }).click();
    await expect(first.getByRole('alert')).toContainText(
      '可重试或继续手动审核',
    );

    await first.getByRole('button', { name: '获取规则建议' }).click();
    await expect(first.getByText('本地规则建议')).toBeVisible();
    await expect(first.getByLabel('集合运算')).not.toBeChecked();
    await first.getByRole('button', { name: '用建议替换标签' }).click();
    await expect(first.getByLabel('集合运算')).toBeChecked();
    await expect(first.getByLabel('已核对本题')).not.toBeChecked();

    for (const [index, points] of [5, 7, 8].entries()) {
      const question = questions.nth(index);
      await question
        .getByRole('combobox', { name: '题型' })
        .selectOption(['single', 'blank', 'written'][index]);
      await question.getByLabel('分值', { exact: true }).fill(String(points));
      if (index > 0) {
        await question
          .getByLabel(index === 1 ? '函数性质' : '概率统计')
          .check();
      }
      await question.getByLabel('已核对本题').check();
    }

    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect(page.getByText('草稿已保存。')).toBeVisible();
    const warnings = page.getByLabel('已对照原卷处理拆题提示');
    if (await warnings.count()) await warnings.check();
    await page.getByRole('button', { name: '确认试卷', exact: true }).click();
    await page.getByRole('button', { name: '冻结试卷' }).click();
    await expect(page.getByText('试卷已确认并冻结。')).toBeVisible();

    await page.getByRole('button', { name: '题库管理' }).click();
    await page.getByRole('button', { name: '新建专题' }).click();
    await page.getByLabel('标题', { exact: true }).fill('集合运算入门');
    await page
      .getByLabel('简介', { exact: true })
      .fill('用一道自编题练习集合的交集。');
    await page.getByLabel('公开地址标识').fill('sets-and-intersections');
    await page
      .getByRole('combobox', { name: '来源试卷' })
      .selectOption({ label: '自编样卷（3 题）' });
    await page.locator('.topic-list input').first().check();
    await page.getByText('英文版（可选）', { exact: true }).click();
    await page
      .getByLabel('英文标题', { exact: true })
      .fill('Sets and Intersections');
    await page
      .getByLabel('英文简介', { exact: true })
      .fill('Practice intersecting two sets with an original question.');
    await page
      .getByLabel('第 1 题英文题干')
      .fill(
        String.raw`Let $A=\{1,2,3\}$ and $B=\{2,4\}$. Which set is $A\cap B$?` +
          '\nA. {1}    B. {2}    C. {3}    D. {4}',
      );

    await page.getByRole('button', { name: '保存草稿' }).click();
    const englishPreview = page.getByRole('link', { name: '打开英文草稿预览' });
    await expect(englishPreview).toBeVisible();
    const previewUrl = (await englishPreview.getAttribute('href'))!;
    const zh = '/practice-topics/sets-and-intersections/';
    const en = '/en' + zh;
    expect((await visitor.request.get(previewUrl)).status()).toBe(404);
    expect((await visitor.request.get(en)).status()).toBe(404);
    const privatePreview = await page.request.get(previewUrl);
    expect(privatePreview.headers()['x-robots-tag']).toBe('noindex');

    await page.getByLabel(/我已核对预览/).check();
    await page.getByRole('button', { name: '发布专题' }).click();
    await expect(page.getByText('专题已发布，可以打开公开页。')).toBeVisible();
    await visitor.goto(zh);
    await expect(
      visitor.getByRole('heading', { name: '集合运算入门' }),
    ).toBeVisible();
    await expect(visitor.locator('.stem .katex').first()).toBeVisible();
    const coldLoad = await visitor.evaluate(async () => {
      await document.fonts.ready;
      const resources = performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];
      const mathAssets = resources.filter(({ name }) =>
        name.includes('/topic-assets/'),
      );
      const documentTiming = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      return {
        htmlBytes: documentTiming.encodedBodySize,
        mathRequests: mathAssets.length,
        mathBytes: mathAssets.reduce(
          (sum, resource) => sum + resource.encodedBodySize,
          0,
        ),
      };
    });
    expect(coldLoad.mathRequests).toBeGreaterThan(0);
    console.log('Cold public page, localhost:', coldLoad);
    await visitor.getByRole('link', { name: 'English' }).click();
    await expect(
      visitor.getByRole('heading', { name: 'Sets and Intersections' }),
    ).toBeVisible();
    await expect(visitor.locator('html')).toHaveAttribute('lang', 'en');
    await expect(visitor.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      origin + en,
    );
    await expect(
      visitor.locator('link[hreflang=zh-CN][rel=alternate]'),
    ).toHaveAttribute('href', origin + zh);
    await expect(visitor.locator('.stem .katex').first()).toBeVisible();
    expect(
      await visitor.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    const sitemap = await visitor.request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain(origin + en);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '下线专题' }).click();
    await expect(page.getByText('专题已下线，草稿仍可编辑。')).toBeVisible();
    expect((await visitor.request.get(zh)).status()).toBe(404);
    expect((await visitor.request.get(en)).status()).toBe(404);
    expect(
      await (await visitor.request.get('/sitemap.xml')).text(),
    ).not.toContain(origin + en);
  } finally {
    await anonymous.close();
  }
});
