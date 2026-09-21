/* global document, location, scrollTo, window */

import { applicationCatalog, availableApps } from "./applicationCatalog.js";

const main = document.querySelector("main");
const workbenchIcon =
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
const riskIcon =
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 18h18"/><path d="m5 15 4-5 3 3 5-8 2 4"/><circle cx="5" cy="15" r="1"/><circle cx="9" cy="10" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="17" cy="5" r="1"/></svg>';
const iconFor = (app) => (app.id === "risk-warning" ? riskIcon : workbenchIcon);
const escapeText = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function applicationMarkup(app) {
  return `<article class="catalog-entry"><span class="catalog-icon">${iconFor(app)}</span><div><h3>${escapeText(app.name)}</h3><p>${escapeText(app.summary)}</p></div><a class="primary" href="${escapeText(app.href)}" target="_blank" rel="noopener" aria-label="打开${escapeText(app.name)}（新标签页）">进入${escapeText(app.name)} ↗</a></article>`;
}
let directoryQuery = "";
function updateDirectory() {
  const q = directoryQuery.trim().toLowerCase();
  const apps = availableApps().filter((a) =>
    (a.name + a.summary + a.category).toLowerCase().includes(q),
  );
  document.getElementById("directory-results").innerHTML =
    apps.map(applicationMarkup).join("") ||
    '<div class="directory-empty"><p>未找到匹配的应用</p><button id="clear-directory" class="outline">清除搜索</button></div>';
  document.getElementById("directory-count").textContent =
    `${apps.length} 个应用`;
  document.getElementById("clear-directory")?.addEventListener("click", () => {
    directoryQuery = "";
    document.getElementById("directory-query").value = "";
    updateDirectory();
    document.getElementById("directory-query").focus();
  });
}
const title = (label, h, p) =>
  `<section class="page-title"><div class="container"><div class="breadcrumb"><a href="#/">首页</a><span>/ ${label}</span></div><h1>${h}</h1><p>${p}</p></div></section>`;
const views = {
  "": () =>
    `<section class="hero"><div class="hero-image" aria-hidden="true"></div><div class="hero-inner"><p class="eyebrow">齐齐哈尔 · 粮食商情</p><h1>知粮情<br><span>见未来</span></h1><div class="hero-rule"></div><p class="hero-caption">汇聚粮食信息 · 服务区域经营</p></div><a class="hero-index" href="#/applications" aria-label="浏览全部应用"><span>应用中心</span><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M4 12h16M13 5l7 7-7 7"/></svg></a></section><div class="home-services container"><section class="portal-apps"><div class="portal-section-title"><h2>应用中心</h2></div><div class="homepage-apps">${availableApps()
      .filter((app) => app.featured)
      .slice(0, 3)
      .map(
        (app) =>
          `<div class="portal-app-layout"><div class="application-intro"><span class="line-icon" aria-hidden="true">${iconFor(app)}</span><h3>${escapeText(app.name)}</h3><p>${escapeText(app.summary)}</p></div><div class="application-action"><a class="launch-app" href="${escapeText(app.href)}" target="_blank" rel="noopener" aria-label="进入${escapeText(app.name)}（新标签页）"><span>进入${escapeText(app.name)}</span><span aria-hidden="true">↗</span></a><span class="launch-note">在新标签页打开</span></div></div>`,
      )
      .join(
        "",
      )}</div></section><section class="portal-support"><div><h2>服务支持</h2><a href="#/support">查看使用指南 →</a></div><a class="support-topic" href="#/support?topic=start"><span>如何进入工作台</span><span aria-hidden="true">↗</span></a><a class="support-topic" href="#/support?topic=access"><span>登录与访问帮助</span><span aria-hidden="true">↗</span></a></section></div>`,
  applications: () =>
    `${title("应用中心", "应用中心", "")}<section class="container application-directory"><div class="directory-tools"><label for="directory-query">查找应用</label><input id="directory-query" type="search" value="${escapeText(directoryQuery)}" placeholder="输入应用名称或关键词"><span id="directory-count" role="status"></span></div><div id="directory-results" class="catalog-list"></div></section>`,
  about: () =>
    `${title("关于平台", "立足粮食业务，服务区域经营", "齐齐哈尔粮食商情企业平台")}<section class="container prose"><h2>平台定位</h2><p>平台是独立业务系统的统一应用入口，以区域粮食商情业务为起点，支持后续持续建设与完善。</p><h2>当前应用</h2><p>业务工作台承载粮食信息采集、监测与分析；风险研判预警系统独立承担风险发现、证据研判和预警处置。两个系统均从应用中心进入。</p><a class="primary" href="#/applications">浏览应用中心 →</a></section>`,
  support: () =>
    `${title("服务支持", "使用指南", "")}<section class="container help"><details id="help-start" tabindex="-1"><summary>如何进入业务系统？</summary><div class="help-answer"><p>打开“应用中心”，选择“业务工作台”或“风险研判预警”。两个系统均在新标签页独立打开。</p><a class="text-link" href="#/applications">查看应用中心 →</a></div></details><details><summary>如何切换系统和返回首页？</summary><div class="help-answer"><p>各业务系统在新标签页独立运行。返回本标签页即可继续使用应用中心选择其他系统。</p></div></details><details id="help-access" tabindex="-1"><summary>系统需要登录或无法打开怎么办？</summary><div class="help-answer"><p>各系统使用平台账号和权限。若暂时无法访问，请先检查网络与访问地址；仍无法打开时，联系系统管理员。</p></div></details><details><summary>搜索可以找到哪些内容？</summary><div class="help-answer"><p>平台搜索查找应用和使用指南。进入具体系统后，使用该系统自己的业务导航。</p></div></details></section>`,
};
function render() {
  document.querySelector("[data-login-entry]").href =
    applicationCatalog[0].href;
  document.querySelectorAll("[data-app-id]").forEach((link) => {
    const app = availableApps().find((a) => a.id === link.dataset.appId);
    if (app) {
      link.href = app.href;
      link.textContent = app.name;
    } else link.hidden = true;
  });
  const [key, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  main.innerHTML = (
    views[key] ||
    (() =>
      `${title("页面未找到", "页面未找到", "请返回首页或应用目录重新选择。")}<div class="container prose"><a class="primary" href="#/">返回首页 →</a></div>`)
  )();
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.hash === "#/" + key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.body.classList.remove("menu-open");
  document.querySelector(".menu-toggle").setAttribute("aria-expanded", "false");
  document.querySelector(".menu-toggle").textContent = "菜单";
  if (key === "applications") {
    updateDirectory();
    document.getElementById("directory-query").oninput = (e) => {
      directoryQuery = e.target.value;
      updateDirectory();
    };
  }
  main.focus({ preventScroll: true });
  scrollTo(0, 0);
  const topic = new URLSearchParams(query).get("topic");
  if (key === "support" && ["start", "access"].includes(topic)) {
    const section = document.getElementById("help-" + topic);
    section.open = true;
    section.scrollIntoView();
    section.focus({ preventScroll: true });
  }
}
window.addEventListener("hashchange", render);
render();
document.querySelector(".menu-toggle").onclick = (e) => {
  const open = document.body.classList.toggle("menu-open");
  e.currentTarget.setAttribute("aria-expanded", String(open));
  e.currentTarget.textContent = open ? "收起" : "菜单";
};
const dialog = document.querySelector("dialog"),
  input = document.querySelector("#search-input"),
  results = document.querySelector("#results");
const entries = [
  ...availableApps().map((a) => [a.name, a.summary, a.href]),
  ["应用中心", "平台应用目录", "#/applications"],
  ["使用指南", "打开工作台、登录与访问帮助", "#/support"],
  ["关于平台", "平台定位与持续建设", "#/about"],
];
function search() {
  const matches = entries.filter((x) =>
    (x[0] + x[1]).includes(input.value.trim()),
  );
  results.replaceChildren();
  for (const [name, desc, href] of matches) {
    const a = document.createElement("a");
    a.href = href;
    if (href.startsWith("https:")) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    const b = document.createElement("b");
    b.textContent = name;
    const p = document.createElement("p");
    p.textContent = desc;
    a.append(b, p);
    a.onclick = () => dialog.close();
    results.append(a);
  }
  if (!matches.length)
    results.textContent = "未找到匹配内容，请尝试“工作台”或“使用指南”。";
}
document.querySelector(".search-toggle").onclick = () => {
  dialog.showModal();
  input.value = "";
  search();
  input.focus();
};
document.querySelector("#close-search").onclick = () => dialog.close();
dialog.addEventListener("close", () =>
  document.querySelector(".search-toggle").focus(),
);
dialog.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    dialog.close();
  }
});
input.oninput = search;

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
    document.body.classList.remove("menu-open");
    const button = document.querySelector(".menu-toggle");
    button.setAttribute("aria-expanded", "false");
    button.textContent = "菜单";
    button.focus();
  }
});
