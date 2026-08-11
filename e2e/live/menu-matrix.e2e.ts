import { expect, test } from "./fixtures";

const menuRoutes = [
  ["/#/我的工作/待我处理", "待我处理"],
  ["/#/我的工作/待我填报", "待我填报"],
  ["/#/我的工作/待我审核", "待我审核"],
  ["/#/我的工作/退回与异常", "退回与异常"],
  ["/#/我的工作/已办事项", "已办事项"],
  ["/#/经营总览/风险关注", "粮食商情经营总览"],
  ["/#/经营总览/履责情况", "粮食商情经营总览"],
  ["/#/经营总览/结果发布", "粮食商情经营总览"],
  ["/#/产情监测/玉米产情填报", "玉米产情调查表"],
  ["/#/产情监测/大豆产情填报", "大豆产情调查表"],
  ["/#/产情监测/稻谷产情填报", "稻谷产情调查表"],
  ["/#/产情监测/产情任务", "产情任务作业"],
  ["/#/产情监测/调查对象", "产情对象名录"],
  ["/#/产情监测/数据审核", "产情任务作业"],
  ["/#/产情监测/产情分析", "产情年度对比分析"],
  ["/#/市场监测/玉米市场采集", "玉米市场采集表"],
  ["/#/市场监测/大豆市场采集", "大豆市场采集表"],
  ["/#/市场监测/稻谷市场采集", "稻谷市场采集表"],
  ["/#/市场监测/玉米物流监测", "粮食物流节点监测表"],
  ["/#/市场监测/大豆物流监测", "粮食物流节点监测表"],
  ["/#/市场监测/稻谷物流监测", "粮食物流节点监测表"],
  ["/#/市场监测/采集任务", "市场任务作业"],
  ["/#/市场监测/监测对象", "市场监测对象名录"],
  ["/#/市场监测/数据审核", "市场任务作业"],
  ["/#/市场监测/市场分析", "市场年度对比分析"],
  ["/#/供需分析/供需平衡", "实时供需平衡"],
  ["/#/供需分析/计算记录", "实时供需平衡"],
  ["/#/报表中心/业务报告", "业务报告"],
] as const;

const entryContracts = new Map<
  string,
  { create: string; dialog: string; form: string }
>([
  ...["玉米", "大豆", "稻谷"].map(
    (product) =>
      [
        `/#/产情监测/${product}产情填报`,
        { create: "新建调查记录", dialog: "新建产情填报", form: "产情填报" },
      ] as const,
  ),
  ...["玉米", "大豆", "稻谷"].map(
    (product) =>
      [
        `/#/市场监测/${product}市场采集`,
        { create: "新建采集记录", dialog: "新建市场填报", form: "市场采集" },
      ] as const,
  ),
  ...["玉米", "大豆", "稻谷"].map(
    (product) =>
      [
        `/#/市场监测/${product}物流监测`,
        {
          create: "新建监测记录",
          dialog: "新建物流监测填报",
          form: "物流监测填报",
        },
      ] as const,
  ),
]);

test("opens every formal business menu against the real backend without shell errors", async ({
  page,
}) => {
  for (const [route, expectedContent] of menuRoutes) {
    await test.step(route, async () => {
      await page.goto(route);
      const main = page.locator("main").first();
      await expect(main).toBeVisible();
      await expect(main).toContainText(expectedContent, { timeout: 10_000 });
      await expect(main).not.toContainText(
        /业务数据读取失败|当前供需结果暂时无法读取|报告服务暂时无法读取|系统服务异常/u,
      );
      await expect(main).not.toContainText(
        /8090|63182|后端端口|本地数据库|演示数据|VITE_|\bmock\b|\bdemo\b/iu,
      );
      const unnamedButtons = await page
        .locator("button:visible")
        .evaluateAll((buttons) =>
          buttons
            .filter(
              (button) =>
                !button.getAttribute("aria-label")?.trim() &&
                !button.getAttribute("title")?.trim() &&
                !button.textContent?.trim(),
            )
            .map((button) => button.outerHTML),
        );
      expect(unnamedButtons).toEqual([]);

      const entry = entryContracts.get(route);
      if (entry) {
        await page.getByRole("button", { name: entry.create }).click();
        const dialog = page.getByRole("dialog", { name: entry.dialog });
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByRole("region", { name: entry.form }),
        ).toBeVisible();
        await expect(
          dialog.getByRole("combobox", { name: "品种" }),
        ).toHaveCount(0);
        await dialog
          .getByRole("button", { name: `关闭${entry.dialog}` })
          .click();
        await expect(dialog).toHaveCount(0);
      }
    });
  }

  await page.goto("/#/经营总览/总揽监测");
  await expect(page.getByRole("main", { name: "总览监测" })).toBeVisible();
  await expect(page.getByTitle("齐齐哈尔粮食商情总览监测地图")).toBeVisible();
  await expect(page.getByRole("main", { name: "总览监测" })).not.toContainText(
    "总览监测地图暂时无法打开",
  );
});
