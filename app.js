(() => {

  const THEME_KEY = "mxd-theme";

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function syncThemeButton() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const light = currentTheme() === "light";
    btn.textContent = light ? "深色背景" : "浅色背景";
    btn.setAttribute("aria-pressed", light ? "true" : "false");
  }

  function setTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
    syncThemeButton();
  }

  function toggleTheme() {
    setTheme(currentTheme() === "light" ? "dark" : "light");
  }

  const IMG_BASE = "https://www.longlegmxd.com/database/editions/cn/current/";
  const PAGE_SIZE = 80;

  // 资料图鉴 / 搜索只展示这些分类；地图、技能仍入库供升级攻略关联，但不出现在图鉴卡片与筛选里
  const TYPE_DEFS = [
    { key: "all", label: "全部" },
    { key: "equip", label: "装备" },
    { key: "monster", label: "怪物" },
    { key: "item", label: "道具" },
    { key: "quest", label: "任务" },
    { key: "npc", label: "NPC" },
  ];
  const HIDDEN_BROWSE_TYPES = new Set(["map", "skill"]);

  const CAT_LABEL = {
    Equipment: "装备",
    Consumable: "消耗",
    Etc: "其他",
    Setup: "设置",
  };

  const STAT_LABEL = {
    reqLevel: "需求等级",
    reqJob: "需求职业码",
    reqSTR: "需求力量",
    reqDEX: "需求敏捷",
    reqINT: "需求智力",
    reqLUK: "需求运气",
    reqPOP: "需求人气",
    incSTR: "力量",
    incDEX: "敏捷",
    incINT: "智力",
    incLUK: "运气",
    incPAD: "物理攻击",
    incMAD: "魔法攻击",
    incPDD: "物理防御",
    incMDD: "魔法防御",
    incACC: "命中",
    incEVA: "回避",
    incSpeed: "移动速度",
    incJump: "跳跃力",
    incMHP: "MaxHP",
    incMMP: "MaxMP",
    tuc: "可砸卷次数",
    attackSpeed: "攻击速度",
    slotMax: "堆叠上限",
    recoveryHP: "恢复HP",
    recoveryMP: "恢复MP",
    success: "成功率",
    cursed: "失败消失率",
    cash: "点装标记",
    tradeBlock: "不可交易",
    only: "唯一",
    notSale: "不可出售",
    quest: "任务物品",
    timeLimited: "限时",
  };

  const state = {
    ready: false,
    type: "all",
    view: "home",
    query: "",
    records: [],
    byKey: new Map(),
    homePage: 0,
    browseType: null,
    browsePage: 0,
    selectedKey: null,
    guides: {
      ready: false,
      catalog: null,
      catId: null,
      query: "",
      articleCache: new Map(),
      openSlug: null,
    },
    mapnav: {
      ready: false,
      maps: [],
      byId: new Map(),
      edges: {},
      startId: null,
      endId: null,
      prefs: { hofca: true, magicSeed: true, mushroom: true, ship: true, bus: true, guide: true, returnScroll: false, other: true },
    },
    jobquests: {
      ready: false,
      data: null,
      chain: "all",
      query: "",
    },
    leveling: {
      ready: false,
      brackets: [],
      meta: null,
      level: 55,
      job: "",
      activeId: null,
      showArticle: true,
      articleCache: new Map(),
      findQuery: "",
      findIndex: 0,
    },
  };

  const el = {
    q: document.getElementById("q"),
    status: document.getElementById("status"),
    typeFilters: document.getElementById("typeFilters"),
    viewTabs: document.getElementById("viewTabs"),
    homeView: document.getElementById("homeView"),
    browseView: document.getElementById("browseView"),
    levelingView: document.getElementById("levelingView"),
    mapnavView: document.getElementById("mapnavView"),
    guidesView: document.getElementById("guidesView"),
    jobquestsView: document.getElementById("jobquestsView"),
    homeLayout: document.getElementById("homeLayout"),
    browseLayout: document.getElementById("browseLayout"),
    resultList: document.getElementById("resultList"),
    detailPanel: document.getElementById("detailPanel"),
    browseCards: document.getElementById("browseCards"),
    browseList: document.getElementById("browseList"),
    browseDetail: document.getElementById("browseDetail"),
    levelInput: document.getElementById("levelInput"),
    jobInput: document.getElementById("jobInput"),
    levelGo: document.getElementById("levelGo"),
    guideFind: document.getElementById("guideFind"),
    guideFindGo: document.getElementById("guideFindGo"),
    areaShortcuts: document.getElementById("areaShortcuts"),
    levelStatus: document.getElementById("levelStatus"),
    bracketNav: document.getElementById("bracketNav"),
    levelMain: document.getElementById("levelMain"),
    levelToc: document.getElementById("levelToc"),
    levelDetail: document.getElementById("levelDetail"),
    levelDetailBody: document.getElementById("levelDetailBody"),
    levelDetailClose: document.getElementById("levelDetailClose"),
    levelDetailBackdrop: document.getElementById("levelDetailBackdrop"),
    searchCard: document.getElementById("searchCard") || document.querySelector(".search-card"),
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function imgUrl(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (/^(\.\/|\/|assets\/)/i.test(path)) return path;
    return IMG_BASE + String(path).replace(/^\//, "");
  }

  function questIconHtml(sizeClass = "") {
    return `<span class="quest-icon ${sizeClass}" title="任务" aria-hidden="true"></span>`;
  }

  function thumbHtml(path, fallback = "·", opts = {}) {
    if (opts && opts.quest) return questIconHtml(opts.sizeClass || "");
    const u = imgUrl(path);
    if (!u) {
      if (fallback === "任" || fallback === "任务") return questIconHtml();
      return `<div class="thumb placeholder">${esc(fallback)}</div>`;
    }
    return `<img class="thumb" loading="lazy" src="${esc(u)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb placeholder',textContent:'×'}))" />`;
  }

  function keyOf(type, id) {
    return `${type}:${id}`;
  }

  function addRecord(rec) {
    state.records.push(rec);
    state.byKey.set(rec.key, rec);
  }

  async function loadJson(name) {
    const res = await fetch(`./data/${name}`);
    if (!res.ok) throw new Error(`无法加载 ${name} (${res.status})`);
    return res.json();
  }

  async function boot() {
    try {
      el.status.textContent = "正在加载 JSON 资料包…";
      const [itemsPack, monstersPack, npcs, mapsPack, questsPack, skillsPack] = await Promise.all([
        loadJson("items.json"),
        loadJson("monsters.json"),
        loadJson("npcs.json"),
        loadJson("maps.json"),
        loadJson("quests.json"),
        loadJson("skills.json"),
      ]);

      for (const it of itemsPack.items || []) {
        const isEquip = it.category === "Equipment";
        const type = isEquip ? "equip" : "item";
        const typeLabel = isEquip ? "装备" : (CAT_LABEL[it.category] || "道具");
        addRecord({
          key: keyOf(type, it.id),
          type,
          typeLabel,
          id: it.id,
          name: it.name || `(未命名 ${it.id})`,
          sub: `${typeLabel}${it.sub_category ? " · " + it.sub_category : ""}${it.is_cash_item ? " · 点装" : ""}`,
          search: `${it.name || ""} ${it.id} ${it.sub_category || ""} ${it.description || ""}`.toLowerCase(),
          thumbnail: it.thumbnail,
          data: it,
        });
      }

      for (const m of monstersPack.monsters || []) {
        addRecord({
          key: keyOf("monster", m.id),
          type: "monster",
          typeLabel: "怪物",
          id: m.id,
          name: m.name || `(怪物 ${m.id})`,
          sub: `Lv.${m.level ?? "?"} · HP ${m.hp ?? "?"}${m.is_boss ? " · BOSS" : ""}`,
          search: `${m.name || ""} ${m.id} ${m.special || ""}`.toLowerCase(),
          thumbnail: m.thumbnail,
          data: m,
        });
      }

      for (const n of npcs || []) {
        addRecord({
          key: keyOf("npc", n.id),
          type: "npc",
          typeLabel: "NPC",
          id: n.id,
          name: n.name || `(NPC ${n.id})`,
          sub: `NPC · ${n.id}`,
          search: `${n.name || ""} ${n.id} ${(n.functions || []).join(" ")}`.toLowerCase(),
          thumbnail: n.thumbnail,
          data: n,
        });
      }

      for (const region of mapsPack.regions || []) {
        for (const mp of region.maps || []) {
          addRecord({
            key: keyOf("map", mp.id),
            type: "map",
            typeLabel: "地图",
            id: mp.id,
            name: mp.name || `(地图 ${mp.id})`,
            sub: `${mp.region || region.region || ""}${mp.street_name ? " · " + mp.street_name : ""}${mp.is_town ? " · 城镇" : ""}`,
            search: `${mp.name || ""} ${mp.id} ${mp.region || ""} ${mp.street_name || ""} ${mp.map_mark || ""}`.toLowerCase(),
            thumbnail: mp.thumbnail || mp.minimap,
            data: mp,
          });
        }
      }

      for (const q of questsPack.quests || []) {
        addRecord({
          key: keyOf("quest", q.id),
          type: "quest",
          typeLabel: "任务",
          id: q.id,
          name: q.name || `(任务 ${q.id})`,
          sub: `${q.region || "未分类"}${q.npc_name ? " · " + q.npc_name : ""}${q.level_min != null ? " · Lv." + q.level_min : ""}`,
          search: `${q.name || ""} ${q.id} ${q.region || ""} ${q.npc_name || ""} ${q.description || ""} ${q.parent || ""}`.toLowerCase(),
          thumbnail: null,
          data: q,
        });
      }

      for (const [group, jobs] of Object.entries(skillsPack)) {
        if (group === "total" || !Array.isArray(jobs)) continue;
        for (const job of jobs) {
          for (const sk of job.skills || []) {
            addRecord({
              key: keyOf("skill", sk.id),
              type: "skill",
              typeLabel: "技能",
              id: sk.id,
              name: sk.name || `(技能 ${sk.id})`,
              sub: `${sk.job || job.job || group} · Max ${sk.max_level ?? "?"}`,
              search: `${sk.name || ""} ${sk.id} ${sk.job || ""} ${sk.description || ""}`.toLowerCase(),
              thumbnail: sk.thumbnail || sk.icon,
              data: { ...sk, _group: group },
            });
          }
        }
      }

      state.ready = true;
      const counts = TYPE_DEFS.filter((t) => t.key !== "all").map((t) => {
        const n = state.records.filter((r) => r.type === t.key).length;
        return `${t.label} ${n}`;
      });
      el.status.textContent = `已加载 ${state.records.length} 条 · ${counts.join(" / ")}`;
      renderBrowseCards();
      renderHome();
      loadLevelingGuides().catch((e) => {
        el.levelStatus.textContent = "升级攻略加载失败：" + (e && e.message ? e.message : e);
      });
    } catch (err) {
      el.status.textContent = "加载失败";
      el.resultList.innerHTML = `<div class="error">${esc(err.message)}<br/>请用本地 HTTP 服务打开本站，例如：<code>python3 -m http.server 8765</code></div>`;
    }
  }

  function filteredRecords(type, query, browseOnlyType) {
    const t = browseOnlyType || type;
    const q = (query || "").trim().toLowerCase();
    return state.records.filter((r) => {
      if (HIDDEN_BROWSE_TYPES.has(r.type)) return false;
      if (t && t !== "all" && r.type !== t) return false;
      if (!q) return true;
      return r.search.includes(q) || String(r.id).includes(q);
    });
  }

  function renderTypeFilters() {
    el.typeFilters.innerHTML = TYPE_DEFS.map(
      (t) => `<button type="button" class="chip ${state.type === t.key ? "active" : ""}" data-type="${t.key}">${t.label}</button>`
    ).join("");
  }

  function listHtml(rows, selectedKey) {
    if (!rows.length) return `<div class="loading">没有匹配结果</div>`;
    return rows
      .map((r) => {
        const isQuest = r.type === "quest";
        const thumb = isQuest
          ? questIconHtml()
          : thumbHtml(r.thumbnail, r.typeLabel.slice(0, 1));
        const d = r.data || {};
        const sub = isQuest
          ? `${esc(d.region || r.sub || "未知地区")} · Lv.${esc(d.level_min ?? d.chain_level_min ?? "0")}+${d.chain_length && d.chain_length > 1 ? " · 任务链" : " · 普通"}`
          : `#${esc(r.id)} · ${esc(r.sub)}`;
        const npcLine = isQuest && d.npc_name
          ? `<div class="item-npc">${esc(d.npc_name)}</div>`
          : "";
        return `<div class="list-item ${isQuest ? "quest-item" : ""} ${r.key === selectedKey ? "active" : ""}" data-key="${esc(r.key)}">
          ${thumb}
          <div>
            <div class="item-title">${esc(r.name)}</div>
            <div class="item-sub">${sub}</div>
            ${npcLine}
          </div>
          <span class="tag">${esc(r.typeLabel)}</span>
        </div>`;
      })
      .join("");
  }

  function pagerHtml(page, total, prefix) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const p = Math.min(page, pages - 1);
    return `<div class="pager" data-pager="${prefix}">
      <button type="button" data-act="prev" ${p <= 0 ? "disabled" : ""}>上一页</button>
      <span>${p + 1} / ${pages} · 共 ${total} 条</span>
      <button type="button" data-act="next" ${p >= pages - 1 ? "disabled" : ""}>下一页</button>
    </div>`;
  }

  function pageSlice(rows, page) {
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const p = Math.min(Math.max(0, page), pages - 1);
    return { p, rows: rows.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE), total: rows.length };
  }

  function renderHome() {
    const all = filteredRecords(state.type, state.query);
    const { p, rows, total } = pageSlice(all, state.homePage);
    state.homePage = p;
    el.homeLayout.classList.toggle("with-detail", true);
    el.resultList.innerHTML = listHtml(rows, state.selectedKey) + pagerHtml(p, total, "home");
    if (state.selectedKey && state.byKey.has(state.selectedKey)) {
      renderDetail(el.detailPanel, state.byKey.get(state.selectedKey));
    } else {
      el.detailPanel.className = "detail empty";
      el.detailPanel.textContent = total ? "选择一条结果查看详情" : "没有匹配结果";
    }
  }

  function renderBrowseCards() {
    const cards = TYPE_DEFS.filter((t) => t.key !== "all").map((t) => {
      const n = state.records.filter((r) => r.type === t.key).length;
      return `<button type="button" class="card-btn" data-browse="${t.key}">
        <div class="t">${t.label}</div>
        <div class="c">${n} 条</div>
      </button>`;
    });
    el.browseCards.innerHTML = cards.join("");
  }

  function renderBrowse() {
    el.browseLayout.classList.toggle("with-detail", true);
    if (!state.browseType) {
      el.browseList.innerHTML = `<div class="loading">选择上方分类浏览</div>`;
      el.browseDetail.className = "detail empty";
      el.browseDetail.textContent = "选择条目查看详情";
      return;
    }
    const all = filteredRecords(state.browseType, state.query, state.browseType);
    const { p, rows, total } = pageSlice(all, state.browsePage);
    state.browsePage = p;
    el.browseList.innerHTML = listHtml(rows, state.selectedKey) + pagerHtml(p, total, "browse");
    if (state.selectedKey && state.byKey.has(state.selectedKey)) {
      renderDetail(el.browseDetail, state.byKey.get(state.selectedKey));
    } else {
      el.browseDetail.className = "detail empty";
      el.browseDetail.textContent = "选择条目查看详情";
    }
  }

  function kv(rows) {
    return `<div class="kv">${rows
      .filter((x) => x[1] !== undefined && x[1] !== null && x[1] !== "")
      .map(([k, v]) => `<div class="k">${esc(k)}</div><div>${v}</div>`)
      .join("")}</div>`;
  }

  function statsBlock(stats) {
    if (!stats || typeof stats !== "object") return "";
    const skip = new Set(["cash"]);
    const entries = Object.entries(stats).filter(([k, v]) => !skip.has(k) && v !== 0 && v !== false && v != null && v !== "");
    if (!entries.length) return "";
    return `<div class="section"><h3>属性</h3><div class="stats-grid">${entries
      .map(([k, v]) => {
        let show = v;
        if (typeof v === "boolean") show = v ? "是" : "否";
        return `<div class="stat"><div class="n">${esc(STAT_LABEL[k] || k)}</div><div class="v">${esc(show)}</div></div>`;
      })
      .join("")}</div></div>`;
  }

  function linkPill(type, id, label) {
    const key = keyOf(type, id);
    if (!state.byKey.has(key)) {
      // try opposite for items
      const alt = type === "item" ? keyOf("equip", id) : type === "equip" ? keyOf("item", id) : null;
      if (alt && state.byKey.has(alt)) {
        return `<span class="pill" data-key="${esc(alt)}">${esc(label || id)}</span>`;
      }
      return `<span class="pill" style="cursor:default;opacity:.7">${esc(label || id)}</span>`;
    }
    return `<span class="pill" data-key="${esc(key)}">${esc(label || id)}</span>`;
  }

  function renderDetail(panel, rec) {
    panel.className = "detail";
    const d = rec.data;
    let body = "";

    if (rec.type === "equip" || rec.type === "item") {
      body = `
        <div class="detail-head">
          ${d.thumbnail ? `<img src="${esc(imgUrl(d.thumbnail))}" alt="" />` : ""}
          <div>
            <h2>${esc(rec.name)}</h2>
            <div class="item-sub">#${esc(d.id)} · ${esc(CAT_LABEL[d.category] || d.category || "")}${d.sub_category ? " / " + esc(d.sub_category) : ""}</div>
          </div>
        </div>
        ${kv([
          ["价格", d.price],
          ["职业", d.req_job_label],
          ["武器类型", d.weapon_type],
          ["攻击速度", d.attack_speed_label],
          ["性别", d.gender],
          ["点装", d.is_cash_item ? "是" : "否"],
        ])}
        ${d.description ? `<div class="section"><h3>说明</h3><div class="desc">${esc(d.description)}</div></div>` : ""}
        ${statsBlock(d.stats)}
        ${
          Array.isArray(d.dropped_by) && d.dropped_by.length
            ? `<div class="section"><h3>掉落来源</h3><div class="pill-row">${d.dropped_by
                .map((x) => linkPill("monster", x.monster_id, `${x.monster_name || x.monster_id}${x.monster_level != null ? " Lv." + x.monster_level : ""}`))
                .join("")}</div></div>`
            : ""
        }
      `;
    } else if (rec.type === "monster") {
      body = `
        <div class="detail-head">
          ${d.thumbnail ? `<img src="${esc(imgUrl(d.thumbnail))}" alt="" />` : ""}
          <div>
            <h2>${esc(rec.name)}</h2>
            <div class="item-sub">#${esc(d.id)}${d.is_boss ? " · BOSS" : ""}${d.special ? " · " + esc(d.special) : ""}</div>
          </div>
        </div>
        <div class="stats-grid">
          ${[
            ["等级", d.level],
            ["HP", d.hp],
            ["MP", d.mp],
            ["经验", d.exp],
            ["物攻", d.PADamage],
            ["物防", d.PDDamage],
            ["魔攻", d.MADamage],
            ["魔防", d.MDDamage],
            ["命中", d.acc],
            ["回避", d.eva],
            ["速度", d.speed],
            ["不死", d.undead ? "是" : "否"],
          ]
            .map(([n, v]) => `<div class="stat"><div class="n">${n}</div><div class="v">${esc(v ?? "-")}</div></div>`)
            .join("")}
        </div>
        ${
          Array.isArray(d.drops) && d.drops.length
            ? `<div class="section"><h3>掉落</h3><table class="table"><thead><tr><th></th><th>物品</th><th>ID</th></tr></thead><tbody>${d.drops
                .map((x) => {
                  const typeGuess = "item";
                  const key = state.byKey.has(keyOf("equip", x.item_id)) ? keyOf("equip", x.item_id) : keyOf(typeGuess, x.item_id);
                  const clickable = state.byKey.has(key);
                  return `<tr>
                    <td>${x.thumbnail ? `<img class="thumb" src="${esc(imgUrl(x.thumbnail))}" alt="" />` : ""}</td>
                    <td>${clickable ? `<a data-key="${esc(key)}">${esc(x.item_name || x.item_id)}</a>` : esc(x.item_name || "(未知)")}</td>
                    <td>${esc(x.item_id)}</td>
                  </tr>`;
                })
                .join("")}</tbody></table></div>`
            : ""
        }
        ${
          Array.isArray(d.maps) && d.maps.length
            ? `<div class="section"><h3>出现地图</h3><div class="pill-row">${d.maps
                .map((x) => {
                  const id = typeof x === "object" ? x.id ?? x.map_id : x;
                  const name = typeof x === "object" ? x.name || id : id;
                  return linkPill("map", id, name);
                })
                .join("")}</div></div>`
            : ""
        }
      `;
    } else if (rec.type === "npc") {
      const funcs = Array.isArray(d.functions) ? d.functions : [];
      body = `
        <div class="detail-head">
          ${d.thumbnail ? `<img src="${esc(imgUrl(d.thumbnail))}" alt="" />` : ""}
          <div>
            <h2>${esc(rec.name)}</h2>
            <div class="item-sub">NPC #${esc(d.id)}</div>
          </div>
        </div>
        ${funcs.length ? `<div class="section"><h3>对话 / 功能摘录</h3><div class="desc">${esc(funcs.slice(0, 20).join("\n"))}</div></div>` : `<div class="item-sub">暂无更多字段</div>`}
      `;
    } else if (rec.type === "map") {
      const mapImg = d.thumbnail || d.minimap ? imgUrl(d.thumbnail || d.minimap) : mapImageUrl(d.id);
      body = `
        <div class="detail-head">
          ${mapImg ? `<img class="map-zoomable" src="${esc(mapImg)}" alt="" data-open-map="${esc(mapImg)}" data-open-title="${esc(rec.name)}" title="点击放大" />` : ""}
          <div>
            <h2>${esc(rec.name)}</h2>
            <div class="item-sub">#${esc(d.id)} · ${esc(d.region || "")}${d.street_name ? " / " + esc(d.street_name) : ""}</div>
            ${mapImg ? `<button type="button" class="ghost-btn" style="margin-top:8px" data-open-map="${esc(mapImg)}" data-open-title="${esc(rec.name)}">放大查看小地图</button>` : ""}
          </div>
        </div>
        ${kv([
          ["城镇", d.is_town ? "是" : "否"],
          ["BGM", d.bgm],
          ["标记", d.map_mark],
          ["回城地图", d.return_map_id],
          ["怪物数", d.monster_count],
          ["传送点", d.portal_count],
          ["任务数", d.quest_count],
          ["刷怪倍率", d.mob_rate],
        ])}
        ${
          Array.isArray(d.exit_names) && d.exit_names.length
            ? `<div class="section"><h3>相连地图</h3><div class="pill-row">${d.exit_names
                .map((x) => linkPill("map", x.id, x.name || x.id))
                .join("")}</div></div>`
            : ""
        }
        ${
          Array.isArray(d.npcs) && d.npcs.length
            ? `<div class="section"><h3>NPC</h3><div class="pill-row">${d.npcs
                .map((x) => {
                  const id = typeof x === "object" ? x.id ?? x.npc_id : x;
                  const name = typeof x === "object" ? x.name || id : id;
                  return linkPill("npc", id, name);
                })
                .join("")}</div></div>`
            : ""
        }
      `;
    } else if (rec.type === "quest") {
      const reqs = Array.isArray(d.requirements_list) ? d.requirements_list : [];
      const rewards = Array.isArray(d.rewards) ? d.rewards : [];
      body = `
        <div class="detail-head">
          ${questIconHtml("quest-icon-lg")}
          <div>
            <h2>${esc(rec.name)}</h2>
            <div class="item-sub">#${esc(d.id)}${d.parent ? " · " + esc(d.parent) : ""}</div>
            <div class="item-npc">${esc(d.npc_name || "")}</div>
          </div>
        </div>
        ${kv([
          ["地区", d.region],
          ["NPC", d.npc_name],
          ["最低等级", d.level_min],
          ["可重复", d.is_repeatable ? "是" : "否"],
          ["每日", d.is_daily ? "是" : "否"],
          ["每周", d.is_weekly ? "是" : "否"],
        ])}
        ${d.description ? `<div class="section"><h3>描述</h3><div class="desc">${esc(d.description)}</div></div>` : ""}
        ${d.requirements ? `<div class="section"><h3>条件摘要</h3><div class="desc">${esc(d.requirements)}</div></div>` : ""}
        ${
          reqs.length
            ? `<div class="section"><h3>需求列表</h3><div class="pill-row">${reqs
                .map((x) => {
                  if (x.type === "item") return linkPill("item", x.id, x.label || `${x.name} x${x.count || 1}`);
                  return `<span class="pill" style="cursor:default">${esc(x.label || JSON.stringify(x))}</span>`;
                })
                .join("")}</div></div>`
            : ""
        }
        ${
          rewards.length
            ? `<div class="section"><h3>奖励</h3><table class="table"><thead><tr><th>类型</th><th>内容</th></tr></thead><tbody>${rewards
                .map((x) => {
                  if (x.type === "exp") return `<tr><td>经验</td><td>${esc(x.value)}</td></tr>`;
                  if (x.type === "meso" || x.type === "money") return `<tr><td>金币</td><td>${esc(x.value)}</td></tr>`;
                  if (x.type === "item") {
                    const key = state.byKey.has(keyOf("equip", x.id)) ? keyOf("equip", x.id) : keyOf("item", x.id);
                    const label = `${x.name || x.id} x${x.count || 1}${x.guaranteed === false ? "（可选）" : ""}`;
                    return `<tr><td>物品</td><td>${state.byKey.has(key) ? `<a data-key="${esc(key)}">${esc(label)}</a>` : esc(label)}</td></tr>`;
                  }
                  return `<tr><td>${esc(x.type || "?")}</td><td>${esc(JSON.stringify(x))}</td></tr>`;
                })
                .join("")}</tbody></table></div>`
            : ""
        }
        ${
          Array.isArray(d.previous_quests) && d.previous_quests.length
            ? `<div class="section"><h3>前置任务</h3><div class="pill-row">${d.previous_quests
                .map((id) => linkPill("quest", id, id))
                .join("")}</div></div>`
            : ""
        }
        ${d.next_quest ? `<div class="section"><h3>后续任务</h3><div class="pill-row">${linkPill("quest", d.next_quest, d.next_quest_name || d.next_quest)}</div></div>` : ""}
      `;
    } else if (rec.type === "skill") {
      body = `
        <div class="detail-head">
          ${d.thumbnail || d.icon ? `<img src="${esc(imgUrl(d.thumbnail || d.icon))}" alt="" />` : ""}
          <div>
            <h2>${esc(rec.name)}</h2>
            <div class="item-sub">#${esc(d.id)} · ${esc(d.job || "")}</div>
          </div>
        </div>
        ${kv([
          ["职业线", d.class_name || d._group],
          ["最高等级", d.max_level],
          ["职业 ID", d.job_id],
        ])}
        ${d.description ? `<div class="section"><h3>说明</h3><div class="desc">${esc(String(d.description).replace(/\\n/g, "\n"))}</div></div>` : ""}
      `;
    } else {
      body = `<pre class="desc">${esc(JSON.stringify(d, null, 2))}</pre>`;
    }

    panel.innerHTML = body;
  }


  function openLevelDetail(rec) {
    if (!el.levelDetail || !el.levelDetailBody) return;
    renderDetail(el.levelDetailBody, rec);
    el.levelDetail.hidden = false;
    el.levelDetail.classList.remove("empty");
    if (el.levelDetailBackdrop) el.levelDetailBackdrop.hidden = false;
  }

  function closeLevelDetail() {
    if (!el.levelDetail) return;
    el.levelDetail.hidden = true;
    if (el.levelDetailBackdrop) el.levelDetailBackdrop.hidden = true;
    if (el.levelDetailBody) {
      el.levelDetailBody.innerHTML = "点击怪物 / 地图 / 任务 / NPC / 道具芯片查看图鉴详情";
    }
  }

  function openRecord(key) {
    if (!state.byKey.has(key)) return;
    state.selectedKey = key;
    if (state.view === "browse") renderBrowse();
    else if (state.view === "leveling") {
      openLevelDetail(state.byKey.get(key));
    } else renderHome();
  }

  function setView(view) {
    // 职业任务已并入攻略专栏侧栏；旧入口重定向
    if (view === "jobquests") {
      state.guides.catId = "职业任务";
      view = "guides";
    }
    state.view = view;
    [...el.viewTabs.querySelectorAll("button")].forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    el.homeView.classList.toggle("hidden", view !== "home");
    el.browseView.classList.toggle("hidden", view !== "browse");
    el.levelingView.classList.toggle("hidden", view !== "leveling");
    if (el.mapnavView) el.mapnavView.classList.toggle("hidden", view !== "mapnav");
    if (el.guidesView) el.guidesView.classList.toggle("hidden", view !== "guides");
    if (el.jobquestsView) el.jobquestsView.classList.add("hidden");
    if (view !== "leveling") closeLevelDetail();
    // search box mainly for encyclopedia（在主菜单下方）
    if (el.searchCard) el.searchCard.classList.toggle("hidden", view === "leveling" || view === "mapnav" || view === "guides");
    if (view === "browse") renderBrowse();
    else if (view === "leveling") renderLeveling();
    else if (view === "mapnav") renderMapNav();
    else if (view === "guides") renderGuides();
    else renderHome();
  }


  async function loadLevelingGuides() {
    const res = await fetch("./guides/leveling/index.json");
    if (!res.ok) throw new Error("无法加载 guides/leveling/index.json");
    const pack = await res.json();
    state.leveling.meta = pack;
    state.leveling.brackets = pack.brackets || [];
    state.leveling.ready = true;
    const rs = pack.resolveStats || {};
    el.levelStatus.textContent = `已载入 ${state.leveling.brackets.length} 篇升级攻略 · 实体链接 怪物${rs.monster || 0}/地图${rs.map || 0}/任务${rs.quest || 0}/NPC${rs.npc || 0}/道具${rs.item || 0}（任务库可能少于 MapleHelper，见 README）`;
    if (el.levelInput) state.leveling.level = Number(el.levelInput.value) || 55;
    pickBracketForLevel(state.leveling.level);
    if (state.view === "leveling") renderLeveling();
  }

  function pickBracketForLevel(level) {
    const lv = Math.max(1, Math.min(200, Number(level) || 1));
    state.leveling.level = lv;
    const ranges = state.leveling.brackets.filter((b) => b.kind === "range");
    let hit = ranges.find((b) => lv >= b.levelMin && lv <= b.levelMax);
    if (!hit) {
      // advice-after that covers level, prefer highest min
      const advice = state.leveling.brackets
        .filter((b) => b.kind === "advice-after" && lv >= b.levelMin)
        .sort((a, b) => b.levelMin - a.levelMin);
      hit = advice[0] || state.leveling.brackets.find((b) => b.kind === "hub") || state.leveling.brackets[0];
    }
    // also surface advice-after cards when level equals threshold — keep range as primary
    state.leveling.activeId = hit ? hit.id : null;
    return hit;
  }

  function getActiveBracket() {
    return state.leveling.brackets.find((b) => b.id === state.leveling.activeId) || null;
  }

  function getPrevNext(bracket) {
    const ranges = state.leveling.brackets.filter((b) => b.kind === "range" || b.kind === "advice-after");
    // navigate among ordered non-hub first
    const list = state.leveling.brackets.filter((b) => b.kind !== "hub");
    const i = list.findIndex((b) => b.id === bracket.id);
    return {
      prev: i > 0 ? list[i - 1] : null,
      next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
    };
  }

  function entityKey(type, id) {
    if (type === "item") {
      if (state.byKey.has(keyOf("equip", id))) return keyOf("equip", id);
      return keyOf("item", id);
    }
    if (type === "quest") {
      // quest ids in data may be zero-padded strings
      const raw = keyOf("quest", id);
      if (state.byKey.has(raw)) return raw;
      const pad = String(id).padStart(5, "0");
      if (state.byKey.has(keyOf("quest", pad))) return keyOf("quest", pad);
      return raw;
    }
    return keyOf(type, id);
  }

  function mentionPills(mentioned, types) {
    const rows = (mentioned || []).filter((m) => types.includes(m.type));
    if (!rows.length) return `<span class="item-sub">暂无已解析条目（原文仍可在全文中阅读）</span>`;
    // de-dupe by type:id
    const seen = new Set();
    const pills = [];
    for (const m of rows) {
      const k = `${m.type}:${m.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const key = entityKey(m.type, m.id);
      const label =
        m.type === "monster" && m.level != null
          ? `${m.name} Lv.${m.level}`
          : m.name;
      if (state.byKey.has(key)) {
        pills.push(m.type === "quest"
          ? `<span class="pill pill-quest" data-key="${esc(key)}">${questIconHtml("quest-icon-sm")}<span>${esc(label)}</span></span>`
          : `<span class="pill" data-key="${esc(key)}">${esc(label)}</span>`);
      } else {
        pills.push(m.type === "quest"
          ? `<span class="pill pill-quest" style="cursor:default;opacity:.7">${questIconHtml("quest-icon-sm")}<span>${esc(label)}</span></span>`
          : `<span class="pill" style="cursor:default;opacity:.7">${esc(label)}</span>`);
      }
      if (pills.length >= 60) break;
    }
    return `<div class="pill-row">${pills.join("")}</div>`;
  }

  function renderBracketNav() {
    const active = state.leveling.activeId;
    el.bracketNav.innerHTML = state.leveling.brackets
      .map((b) => {
        const label =
          b.kind === "hub"
            ? b.title
            : b.kind === "advice-after"
              ? `${b.levelMin}+ ${b.title.replace(/的(一些)?建议/, "建议")}`
              : `${b.levelMin}-${b.levelMax}`;
        const cls = [
          "bracket-chip",
          b.id === active ? "active" : "",
          b.kind === "advice-after" ? "advice" : "",
          b.kind === "hub" ? "hub" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button type="button" class="${cls}" data-bracket="${b.id}">${esc(label)}</button>`;
      })
      .join("");
  }

  async function ensureArticle(bracket) {
    if (!bracket || !bracket.bodyHtmlFile) return "";
    const cache = state.leveling.articleCache;
    if (cache.has(bracket.id)) return cache.get(bracket.id);
    const res = await fetch(`./guides/leveling/${bracket.bodyHtmlFile}`);
    if (!res.ok) throw new Error("无法加载攻略正文");
    let html = await res.text();
    // Article HTML is injected into index.html; rewrite paths relative to site root
    html = html
      .replace(/(src=["'])\.\.\/images\//g, "$1./guides/leveling/images/")
      .replace(/(src=["'])(?:\.\/)?images\//g, "$1./guides/leveling/images/")
      .replace(/(src=["'])guides\/leveling\/images\//g, "$1./guides/leveling/images/");
    cache.set(bracket.id, html);
    return html;
  }



  function padMapId(id) {
    const s = String(id ?? "").replace(/\D/g, "");
    if (!s) return "";
    return s.padStart(9, "0");
  }


  async function loadGuidesCatalog() {
    if (state.guides.ready) return;
    const res = await fetch("./guides/hub/catalog.json");
    if (!res.ok) throw new Error("无法加载 guides/hub/catalog.json");
    state.guides.catalog = await res.json();
    state.guides.ready = true;
    if (!state.guides.catId) {
      const first = (state.guides.catalog.categories || [])[0];
      state.guides.catId = first ? first.id : null;
    }
  }

  function currentGuideCat() {
    const cats = (state.guides.catalog && state.guides.catalog.categories) || [];
    return cats.find((c) => c.id === state.guides.catId) || cats[0] || null;
  }

  function renderGuidesCats() {
    const box = document.getElementById("guidesCats");
    if (!box) return;
    const cats = (state.guides.catalog && state.guides.catalog.categories) || [];
    box.innerHTML = cats
      .map(
        (c) =>
          `<button type="button" class="guides-cat-btn ${c.id === state.guides.catId ? "active" : ""} ${c.priority ? "guides-cat-priority" : ""}" data-guide-cat="${esc(c.id)}">${esc(c.title)}</button>`
      )
      .join("");
  }

  function showGuidesList() {
    const list = document.getElementById("guidesList");
    const art = document.getElementById("guidesArticle");
    const jq = document.getElementById("guidesJobquests");
    if (list) list.classList.remove("hidden");
    if (art) art.classList.add("hidden");
    if (jq) jq.classList.add("hidden");
    state.guides.openSlug = null;
  }

  function showGuidesJobquestsPanel() {
    const list = document.getElementById("guidesList");
    const art = document.getElementById("guidesArticle");
    const jq = document.getElementById("guidesJobquests");
    if (list) list.classList.add("hidden");
    if (art) art.classList.add("hidden");
    if (jq) jq.classList.remove("hidden");
    state.guides.openSlug = null;
  }

  function renderGuidesList() {
    const cat = currentGuideCat();
    const title = document.getElementById("guidesCatTitle");
    const status = document.getElementById("guidesStatus");
    const list = document.getElementById("guidesList");
    const gs = document.getElementById("guidesSearch");
    if (title) title.textContent = cat ? cat.title : "攻略专栏";
    if (!cat) {
      if (status) status.textContent = "没有栏目";
      if (list) list.innerHTML = "";
      return;
    }
    if (cat.special === "jobquests") {
      if (gs) {
        gs.placeholder = "搜任务名 / NPC / ID";
        gs.value = state.jobquests.query || "";
      }
      showGuidesJobquestsPanel();
      renderJobQuests().then(() => {
        // 同步状态到攻略工具栏
        const jqStatus = document.getElementById("jobquestsStatus");
        if (status && jqStatus && jqStatus.textContent) status.textContent = jqStatus.textContent;
        else if (status) status.textContent = "职业任务摘录（原顶栏已并入本栏目）";
      });
      return;
    }
    if (gs) {
      gs.placeholder = "在本栏目搜索标题";
      if (document.activeElement !== gs) gs.value = state.guides.query || "";
    }
    if (cat.special === "mapnav") {
      if (status) status.textContent = "路线查询内建页 + 本栏本地总览图";
      const q = (state.guides.query || "").trim().toLowerCase();
      const rows = (cat.articles || []).filter((a) => {
        if (a.kind === "category" || a.kind === "hub") return false;
        if (!q) return true;
        return String(a.title || "").toLowerCase().includes(q);
      });
      const built = `<div class="guides-item" data-guide-special="mapnav"><div><div class="item-title">移动地图（总览原图）</div><div class="item-sub">城镇/大陆互通一图 · 新标签查看</div></div><span class="tag">原图</span></div>`;
      const arts = rows
        .map((a) => {
          const ok = !!a.bodyHtmlFile;
          return `<div class="guides-item" data-guide-open="${esc(a.bodyHtmlFile || "")}" data-guide-title="${esc(a.title)}" data-guide-src="${esc(a.sourceUrl || "")}">
            <div>
              <div class="item-title">${esc(a.title)}</div>
              <div class="item-sub">${ok ? "本地总览图 · 可放大" : "尚未本地化"}</div>
            </div>
            <span class="tag">${ok ? "本地" : "缺"}</span>
          </div>`;
        })
        .join("");
      if (list) list.innerHTML = built + arts;
      showGuidesList();
      return;
    }
    if (cat.special === "leveling") {
      if (status) status.textContent = "等级路线也可在「升级路线」页按等级查看";
    }
    const q = (state.guides.query || "").trim().toLowerCase();
    const rows = (cat.articles || []).filter((a) => {
      if (a.kind === "category" || a.kind === "hub") return false;
      if (!q) return true;
      return String(a.title || "").toLowerCase().includes(q);
    });
    const ready = rows.filter((a) => a.bodyHtmlFile).length;
    const externalCount = rows.filter((a) => a.kind === "external" && a.sourceUrl).length;
    if (status) {
      if (externalCount && externalCount === rows.length) {
        status.textContent = `本栏 ${rows.length} 个站外链接 · 只打开第三方页面，本站不抓取，也不说明是否准确或是否还能打开`;
      } else if (cat.special === "leveling") {
        status.textContent = `本栏 ${rows.length} 篇 · 已本地化 ${ready} · 也可切到「升级路线」`;
      } else {
        status.textContent = `本栏 ${rows.length} 篇 · 已本地化 ${ready}` + (externalCount ? ` · 站外链接 ${externalCount}` : "");
      }
    }
    if (!list) return;
    const extra =
      cat.special === "leveling"
        ? `<div class="guides-item" data-guide-special="leveling"><div><div class="item-title">打开升级路线（按等级）</div><div class="item-sub">带目录跳转、地区芯片与图鉴关联</div></div><span class="tag">内建</span></div>`
        : "";
    list.innerHTML =
      extra +
      rows
        .map((a) => {
          if (a.kind === "external" && a.sourceUrl) {
            const sub = a.listNote || "站外链接。本站不抓取、不接入，也不说明这个页面是否准确或是否还能打开。";
            return `<a class="guides-item guides-item-external" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">
            <div>
              <div class="item-title">${esc(a.title)}</div>
              <div class="item-sub">${esc(sub)}</div>
            </div>
            <span class="tag">站外</span>
          </a>`;
          }
          const ok = !!a.bodyHtmlFile;
          const sub = a.listNote || (ok ? "本地可读" : "尚未抓取正文（仍可打开原文）");
          return `<div class="guides-item" data-guide-open="${esc(a.bodyHtmlFile || "")}" data-guide-title="${esc(a.title)}" data-guide-src="${esc(a.sourceUrl || "")}">
            <div>
              <div class="item-title">${esc(a.title)}</div>
              <div class="item-sub">${esc(sub)}</div>
            </div>
            <span class="tag">${ok ? "本地" : "原文"}</span>
          </div>`;
        })
        .join("");
    showGuidesList();
  }

  async function openGuideArticle(file, title, sourceUrl) {
    const list = document.getElementById("guidesList");
    const art = document.getElementById("guidesArticle");
    const jq = document.getElementById("guidesJobquests");
    const h = document.getElementById("guidesArticleTitle");
    const body = document.getElementById("guidesArticleBody");
    const src = document.getElementById("guidesSource");
    if (list) list.classList.add("hidden");
    if (jq) jq.classList.add("hidden");
    if (art) art.classList.remove("hidden");
    if (h) h.textContent = title || "";
    if (src) {
      src.href = sourceUrl || "#";
      src.style.display = sourceUrl ? "" : "none";
    }
    if (!file) {
      if (body)
        body.innerHTML = `<div class="item-sub">这篇还没有本地正文。请点右上角「来源原文」，或等抓取完成后再刷新。</div>`;
      return;
    }
    if (body) body.innerHTML = `<div class="loading">加载正文…</div>`;
    try {
      let html = state.guides.articleCache.get(file);
      if (!html) {
        const res = await fetch(`./guides/hub/${file}`);
        if (!res.ok) throw new Error("无法加载 " + file);
        html = await res.text();
        html = html
          .replace(/((?:src|href)=["'])\.\.\/images\//g, "$1./guides/hub/images/")
          .replace(/((?:src|href)=["'])(?:\.\/)?images\//g, "$1./guides/hub/images/")
          .replace(/((?:src|href)=["'])guides\/hub\/images\//g, "$1./guides/hub/images/");
        state.guides.articleCache.set(file, html);
      }
      if (body) {
        body.innerHTML = html;
        body.querySelectorAll("img").forEach((img) => {
          if (!img.dataset.openMap) {
            const src = img.getAttribute("src") || "";
            if (src) {
              img.dataset.openMap = src;
              img.dataset.openTitle = img.getAttribute("alt") || title || "配图";
              img.classList.add("map-zoomable");
              img.title = img.title || "点击放大";
            }
          }
        });
      }
      state.guides.openSlug = file;
    } catch (e) {
      if (body) body.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    }
  }

  async function renderGuides() {
    const status = document.getElementById("guidesStatus");
    try {
      await loadGuidesCatalog();
      renderGuidesCats();
      renderGuidesList();
    } catch (e) {
      if (status) status.textContent = e.message || String(e);
    }
  }


  async function loadJobQuestsExcerpt() {
    if (state.jobquests.ready && state.jobquests.data) return state.jobquests.data;
    const res = await fetch("./data/imports/job-quests-excerpt.json");
    if (!res.ok) throw new Error("无法加载 data/imports/job-quests-excerpt.json");
    state.jobquests.data = await res.json();
    state.jobquests.ready = true;
    return state.jobquests.data;
  }

  function jobQuestDisplay(q) {
    const mh = q.maplehelper_excerpt || null;
    const name = (mh && mh.name) || q.name || `(任务 ${q.id})`;
    const level = (mh && (mh.accept_level_min ?? mh.level_min)) ?? q.level_min;
    const npcStart = (mh && mh.npc_start) || q.npc_name || "";
    const npcEnd = (mh && mh.npc_end) || q.npc_name || "";
    const jobReq = (mh && mh.job_req) || "";
    const intro = (mh && mh.intro) || "";
    const requirements =
      (mh && Array.isArray(mh.requirements_ui) && mh.requirements_ui.length
        ? mh.requirements_ui.join("；")
        : "") ||
      q.requirements ||
      (Array.isArray(q.requirements_list)
        ? q.requirements_list.map((r) => r.label || r.name || "").filter(Boolean).join("；")
        : "");
    const rewards = Array.isArray(q.rewards_preferred)
      ? q.rewards_preferred
      : Array.isArray(q.rewards_local)
        ? q.rewards_local
        : [];
    const rewardsComplete = Object.prototype.hasOwnProperty.call(q, "rewards_preferred_complete")
      ? q.rewards_preferred_complete !== false
      : mh
        ? mh.rewards_complete !== false
        : true;
    const uiConfirmed = !!mh;
    const sourceLabel = uiConfirmed ? "UI 已核对" : "本地骨架";
    return {
      id: q.id,
      name,
      level,
      region: q.region || "",
      npcStart,
      npcEnd,
      jobReq,
      intro,
      description: q.description || "",
      requirements,
      rewards,
      rewardsComplete,
      uiConfirmed,
      sourceLabel,
      chain: q.chain || "其他职业相关",
      rewardsSource: Array.isArray(q.rewards_preferred) ? "preferred" : "local",
    };
  }

  function formatJobReward(r) {
    if (!r || typeof r !== "object") return String(r ?? "");
    const t = String(r.type || "").toLowerCase();
    if (t === "exp") return `经验 ${r.value ?? r.count ?? "?"}`;
    if (t === "meso" || t === "money") return `金币 ${r.value ?? r.count ?? "?"}`;
    const name = r.name || (r.id != null ? `道具 ${r.id}` : "道具");
    const count = r.count != null ? ` ×${r.count}` : r.value != null ? ` ×${r.value}` : "";
    const note = r.note ? `（${r.note}）` : "";
    return `${name}${count}${note}`;
  }

  function renderJobQuestCard(disp) {
    const pills = [];
    if (disp.level != null && disp.level !== "") pills.push(`Lv.${esc(disp.level)}+`);
    if (disp.jobReq) pills.push(`职业：${esc(disp.jobReq)}`);
    if (disp.region) pills.push(esc(disp.region));
    if (disp.npcStart) pills.push(`开始：${esc(disp.npcStart)}`);
    if (disp.npcEnd && disp.npcEnd !== disp.npcStart) pills.push(`结束：${esc(disp.npcEnd)}`);
    else if (disp.npcEnd) pills.push(`NPC：${esc(disp.npcEnd)}`);
    pills.push(`ID ${esc(disp.id)}`);
    const srcBadge = disp.uiConfirmed
      ? `<span class="badge-ok">${esc(disp.sourceLabel)}</span>`
      : `<span class="badge-skel">${esc(disp.sourceLabel)}</span>`;
    const incompleteBadge = !disp.rewardsComplete
      ? `<span class="badge-warn">奖励未滚完 / 可能不全</span>`
      : "";
    const rewardHtml = (disp.rewards || [])
      .map((r) => `<span class="jobquest-reward">${esc(formatJobReward(r))}</span>`)
      .join("");
    const rewardBlock = rewardHtml
      ? `<div class="jobquest-rewards">${rewardHtml}${
          !disp.rewardsComplete
            ? `<span class="jobquest-reward incomplete-flag">…奖励区有滑轮，待补全</span>`
            : ""
        }</div>`
      : `<div class="item-sub">暂无奖励摘录</div>`;
    const intro = disp.intro || "";
    const desc = !intro && disp.description ? String(disp.description).replace(/\\n/g, "\n") : "";
    const shortDesc = desc.length > 280 ? desc.slice(0, 280) + "…" : desc;
    return `<article class="jobquest-card ${disp.uiConfirmed ? "ui-confirmed" : ""}">
      <div class="jobquest-card-head">
        <div>
          <div class="item-title">${questIconHtml("quest-icon-sm")} ${esc(disp.name)}</div>
          <div class="item-sub">${esc(disp.chain)} · 奖励来源 ${esc(disp.rewardsSource === "preferred" ? "UI 优先" : "本地对照")}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${srcBadge}${incompleteBadge}</div>
      </div>
      <div class="jobquest-meta">${pills.map((t) => `<span class="pill">${t}</span>`).join("")}</div>
      ${
        disp.requirements
          ? `<div class="jobquest-section"><h4>条件</h4><div class="desc">${esc(disp.requirements)}</div></div>`
          : ""
      }
      <div class="jobquest-section"><h4>奖励</h4>${rewardBlock}</div>
      ${
        intro
          ? `<div class="jobquest-section"><h4>简介</h4><div class="desc">${esc(intro)}</div></div>`
          : shortDesc
            ? `<div class="jobquest-section"><h4>说明（本地）</h4><div class="desc">${esc(shortDesc)}</div></div>`
            : ""
      }
    </article>`;
  }

  function renderJobQuestsCats(data) {
    const box = document.getElementById("jobquestsCats");
    if (!box) return;
    const chains = Object.keys((data && data.chains) || {});
    const items = [
      { id: "all", label: "全部摘录" },
      ...chains.map((c) => ({ id: c, label: c })),
      { id: "other", label: "其他职业相关" },
    ];
    box.innerHTML = items
      .map(
        (c) =>
          `<button type="button" class="jobquests-cat-btn ${state.jobquests.chain === c.id ? "active" : ""}" data-job-chain="${esc(c.id)}">${esc(c.label)}</button>`
      )
      .join("");
  }

  function renderJobQuestsBody(data) {
    const title = document.getElementById("jobquestsTitle");
    const status = document.getElementById("jobquestsStatus");
    const note = document.getElementById("jobquestsNote");
    const list = document.getElementById("jobquestsList");
    if (title) title.textContent = (data && data.title) || "职业任务摘录";
    const prog = (data && data.excerpt_progress) || {};
    const uiN = prog.ui_confirmed ?? 0;
    const skelN = prog.skeleton_from_local ?? 0;
    const target = prog.target ?? data.mh_category_count_ui ?? 181;
    if (status) {
      status.textContent = `进度：UI 已核对 ${uiN} · 本地骨架 ${skelN} · MapleHelper「职业」约 ${target} 条`;
    }
    if (note) {
      note.innerHTML = `<strong>摘录说明</strong>：${esc(data.note || "")}<br/>奖励优先用 rewards_preferred（UI）；否则用本地 rewards_local。奖励区有滑轮时不得标完整。`;
    }
    const q = (state.jobquests.query || "").trim().toLowerCase();
    const chainFilter = state.jobquests.chain || "all";
    const mainQuests = (data.quests || []).map(jobQuestDisplay);
    const otherQuests = (data.other_job_related_local || []).map((row) => {
      const d = jobQuestDisplay(row);
      d.chain = "其他职业相关";
      return d;
    });
    let groups = [];
    if (chainFilter === "all") {
      const order = Object.keys(data.chains || {});
      for (const c of order) {
        groups.push({ title: c, rows: mainQuests.filter((x) => x.chain === c) });
      }
      groups.push({ title: "其他职业相关", rows: otherQuests });
    } else if (chainFilter === "other") {
      groups.push({ title: "其他职业相关", rows: otherQuests });
    } else {
      groups.push({ title: chainFilter, rows: mainQuests.filter((x) => x.chain === chainFilter) });
    }
    if (q) {
      groups = groups
        .map((g) => ({
          title: g.title,
          rows: g.rows.filter((r) => {
            const blob = `${r.name} ${r.id} ${r.npcStart} ${r.npcEnd} ${r.requirements} ${r.intro}`.toLowerCase();
            return blob.includes(q);
          }),
        }))
        .filter((g) => g.rows.length);
    }
    const total = groups.reduce((n, g) => n + g.rows.length, 0);
    if (status) {
      status.textContent = `进度：UI 已核对 ${uiN} · 本地骨架 ${skelN} · MH「职业」约 ${target} · 当前显示 ${total} 条`;
    }
    if (!list) return;
    if (!total) {
      list.innerHTML = `<div class="loading">没有匹配的职业任务</div>`;
      return;
    }
    list.innerHTML = groups
      .map((g) => {
        const tag = g.title === "其他职业相关" ? `<span class="tag">本地</span>` : `<span class="tag">${g.rows.length}</span>`;
        return `<section class="jobquests-chain-block">
          <div class="jobquests-chain-title">${esc(g.title)} ${tag}</div>
          ${g.rows.map(renderJobQuestCard).join("")}
        </section>`;
      })
      .join("");
  }

  async function renderJobQuests() {
    const status = document.getElementById("jobquestsStatus");
    const list = document.getElementById("jobquestsList");
    try {
      if (list && !state.jobquests.ready) list.innerHTML = `<div class="loading">加载职业任务摘录…</div>`;
      const data = await loadJobQuestsExcerpt();
      renderJobQuestsCats(data);
      renderJobQuestsBody(data);
    } catch (e) {
      if (status) status.textContent = e.message || String(e);
      if (list) list.innerHTML = `<div class="error">${esc(e && e.message ? e.message : e)}</div>`;
    }
  }



  const MAP_NAV_IMG_BASE = "https://www.longlegmxd.com/wp-content/plugins/map-navigator/mapres/";

  function mapImageUrl(id) {
    const pad = padMapId(id);
    if (!pad) return null;
    // map-navigator 公开小地图（webp）；比 cn edition images/maps 覆盖更全
    return `${MAP_NAV_IMG_BASE}${pad}.webp`;
  }

  function mapImageUrlFallback(id) {
    const raw = String(id ?? "").replace(/^0+/, "") || "0";
    return imgUrl(`images/maps/${raw}.png`);
  }

  const mapLb = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    px: 0,
    py: 0,
  };

  function applyLightboxTransform() {
    const img = document.getElementById("mapLightboxImg");
    if (!img) return;
    img.style.transform = `translate(calc(-50% + ${mapLb.x}px), calc(-50% + ${mapLb.y}px)) scale(${mapLb.scale})`;
  }

  function openMapLightbox(url, title) {
    const box = document.getElementById("mapLightbox");
    const img = document.getElementById("mapLightboxImg");
    const t = document.getElementById("mapLightboxTitle");
    if (!box || !img) return;
    t.textContent = title || "地图";
    img.src = url;
    mapLb.scale = 1;
    mapLb.x = 0;
    mapLb.y = 0;
    applyLightboxTransform();
    box.hidden = false;
  }

  function closeMapLightbox() {
    const box = document.getElementById("mapLightbox");
    if (box) box.hidden = true;
  }

  function methodAllowed(method, prefs) {
    const m = String(method || "");
    if (/传送门|脚本门/.test(m) || m === "地图传送门") return true;
    if (/霍夫卡/.test(m)) return !!prefs.hofca;
    if (/魔法种子/.test(m)) return !!prefs.magicSeed;
    if (/蘑菇/.test(m)) return !!prefs.mushroom;
    if (/船/.test(m)) return !!prefs.ship;
    if (/中巴/.test(m)) return !!prefs.bus;
    if (/导游/.test(m)) return !!prefs.guide;
    if (/回城/.test(m)) return !!prefs.returnScroll;
    if (/塔卷|通天塔卷/.test(m)) return !!prefs.other;
    return !!prefs.other;
  }

  function findMapRoute(startId, endId, prefs) {
    const start = padMapId(startId);
    const end = padMapId(endId);
    if (!start || !end) return null;
    if (start === end) return { steps: [{ id: start, method: "当前位置" }], cost: 0 };
    const edges = state.mapnav.edges || {};
    const q = [start];
    const prev = new Map([[start, null]]);
    const via = new Map();
    const dist = new Map([[start, 0]]);
    while (q.length) {
      // simple Dijkstra-ish with queue sorted occasionally
      q.sort((a, b) => (dist.get(a) || 0) - (dist.get(b) || 0));
      const cur = q.shift();
      if (cur === end) break;
      const list = edges[cur] || [];
      for (const e of list) {
        if (!methodAllowed(e.method, prefs)) continue;
        const to = padMapId(e.to);
        if (!to || to === "999999999") continue;
        const nd = (dist.get(cur) || 0) + (Number(e.cost) || 1);
        if (!dist.has(to) || nd < dist.get(to)) {
          dist.set(to, nd);
          prev.set(to, cur);
          via.set(to, e);
          q.push(to);
        }
      }
    }
    if (!prev.has(end)) return null;
    const ids = [];
    let cur = end;
    while (cur) {
      ids.push(cur);
      cur = prev.get(cur);
    }
    ids.reverse();
    const steps = ids.map((id, i) => {
      if (i === 0) return { id, method: "出发", portal: null };
      const e = via.get(id);
      return { id, method: (e && e.method) || "传送", portal: e && e.portal };
    });
    return { steps, cost: dist.get(end) || steps.length - 1 };
  }

  async function loadMapNav() {
    if (state.mapnav.ready) return;
    const res = await fetch("./data/map-nav.json");
    if (!res.ok) throw new Error("无法加载 data/map-nav.json");
    const pack = await res.json();
    state.mapnav.maps = pack.maps || [];
    state.mapnav.edges = pack.edges || {};
    state.mapnav.byId = new Map(state.mapnav.maps.map((m) => [m.id, m]));
    state.mapnav.ready = true;
  }

  function navMajors() {
    return [...new Set(state.mapnav.maps.map((m) => m.majorArea || "其他"))].sort((a, b) => a.localeCompare(b, "zh"));
  }

  function navAreas(major) {
    const set = new Set();
    for (const m of state.mapnav.maps) {
      if ((m.majorArea || "其他") !== major) continue;
      for (const a of m.areas || []) set.add(a);
      if (!(m.areas || []).length) set.add("(全部)");
    }
    return [...set].sort((a, b) => a.localeCompare(b, "zh"));
  }

  function filterNavMaps(major, area, query) {
    const q = (query || "").trim().toLowerCase();
    return state.mapnav.maps.filter((m) => {
      if (!q && m.visible === false) return false;
      if (major && (m.majorArea || "其他") !== major) return false;
      if (area && area !== "(全部)" && area !== "全部") {
        const areas = m.areas || [];
        if (areas.length && !areas.includes(area)) return false;
        if (!areas.length && area !== "(全部)") return false;
      }
      if (!q) return true;
      const blob = `${m.name} ${m.id} ${m.street} ${(m.areas || []).join(" ")}`.toLowerCase();
      return blob.includes(q);
    });
  }

  function fillSelect(sel, items, getValue, getLabel, selected) {
    if (!sel) return;
    sel.innerHTML = items
      .map((it) => {
        const v = getValue(it);
        return `<option value="${esc(v)}" ${String(v) === String(selected) ? "selected" : ""}>${esc(getLabel(it))}</option>`;
      })
      .join("");
  }

  function refreshNavPickers(which) {
    const majors = navMajors();
    const startMajorEl = document.getElementById("navStartMajor");
    const endMajorEl = document.getElementById("navEndMajor");
    const startAreaEl = document.getElementById("navStartArea");
    const endAreaEl = document.getElementById("navEndArea");
    const startMapEl = document.getElementById("navStartMap");
    const endMapEl = document.getElementById("navEndMap");
    const startSearch = document.getElementById("navStartSearch");
    const endSearch = document.getElementById("navEndSearch");
    if (!startMajorEl) return;

    if (!startMajorEl.options.length || which === "init") {
      const prefer = majors.includes("金银岛") ? "金银岛" : majors[0];
      fillSelect(startMajorEl, majors, (x) => x, (x) => x, startMajorEl.value || prefer);
      fillSelect(endMajorEl, majors, (x) => x, (x) => x, endMajorEl.value || prefer);
    }
    const sMajor = startMajorEl.value || majors[0];
    const eMajor = endMajorEl.value || majors[0];
    const sAreas = ["全部", ...navAreas(sMajor)];
    const eAreas = ["全部", ...navAreas(eMajor)];
    fillSelect(startAreaEl, sAreas, (x) => x, (x) => x, startAreaEl.value || "全部");
    fillSelect(endAreaEl, eAreas, (x) => x, (x) => x, endAreaEl.value || "全部");

    const sMaps = filterNavMaps(sMajor, startAreaEl.value, startSearch && startSearch.value).slice(0, 400);
    const eMaps = filterNavMaps(eMajor, endAreaEl.value, endSearch && endSearch.value).slice(0, 400);
    fillSelect(
      startMapEl,
      sMaps,
      (m) => m.id,
      (m) => `${m.name} (${m.id})`,
      state.mapnav.startId || (sMaps[0] && sMaps[0].id)
    );
    fillSelect(
      endMapEl,
      eMaps,
      (m) => m.id,
      (m) => `${m.name} (${m.id})`,
      state.mapnav.endId || (eMaps[0] && eMaps[0].id)
    );
    if (startMapEl.value) state.mapnav.startId = startMapEl.value;
    if (endMapEl.value) state.mapnav.endId = endMapEl.value;
    updateNavPreview(state.mapnav.startId);
  }

  function updateNavPreview(mapId) {
    const title = document.getElementById("navPreviewTitle");
    const preview = document.getElementById("navPreview");
    const m = state.mapnav.byId.get(padMapId(mapId)) || state.mapnav.byId.get(String(mapId));
    if (!preview) return;
    if (!m) {
      if (title) title.textContent = "请选择地图";
      preview.innerHTML = `<span class="item-sub">无预览</span>`;
      preview.dataset.url = "";
      preview.dataset.title = "";
      return;
    }
    const url = mapImageUrl(m.id);
    const fb = mapImageUrlFallback(m.id);
    if (title) title.textContent = `${m.name} · ${m.majorArea}`;
    preview.innerHTML = `<img src="${esc(url)}" alt="" data-fb="${esc(fb || "")}" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}else{this.parentNode.innerHTML='<span class=item-sub>暂无小地图</span>';}" />`;
    preview.dataset.url = url;
    preview.dataset.title = m.name;
  }

  function readNavPrefs() {
    const prefs = { ...state.mapnav.prefs };
    document.querySelectorAll("#navPrefs [data-pref]").forEach((inp) => {
      prefs[inp.dataset.pref] = !!inp.checked;
    });
    state.mapnav.prefs = prefs;
    return prefs;
  }

  function renderNavRoute() {
    const summary = document.getElementById("navSummary");
    const box = document.getElementById("navRoute");
    const startId = state.mapnav.startId;
    const endId = state.mapnav.endId;
    if (!startId || !endId) {
      if (summary) summary.textContent = "请选择出发地与目的地";
      if (box) box.innerHTML = "";
      return;
    }
    const prefs = readNavPrefs();
    const route = findMapRoute(startId, endId, prefs);
    if (!route) {
      if (summary) summary.textContent = "未找到可用路线（可尝试勾选回城卷或其他通道）";
      if (box) box.innerHTML = "";
      return;
    }
    if (summary) {
      summary.textContent = `共 ${route.steps.length} 站 · 代价 ${route.cost}（传送门始终可用；特殊通道受左侧勾选影响）`;
    }
    box.innerHTML = route.steps
      .map((step, i) => {
        const m = state.mapnav.byId.get(step.id);
        const name = m ? m.name : step.id;
        const sub = m ? `${m.majorArea}${(m.areas && m.areas[0]) ? " · " + m.areas[0] : ""}` : "";
        const url = mapImageUrl(step.id);
        const fb = mapImageUrlFallback(step.id);
        const next = route.steps[i + 1];
        const how = next
          ? `下一站：${esc((state.mapnav.byId.get(next.id) || {}).name || next.id)} ← ${esc(next.method)}${next.portal ? " · " + esc(next.portal) : ""}`
          : "已到达目的地";
        return `<article class="mapnav-card">
          <div class="mapnav-card-head">
            <div class="n">${i + 1}</div>
            <div class="grow">
              <div class="item-title">${esc(name)}</div>
              <div class="item-sub">${esc(sub)} · #${esc(step.id)}</div>
              <div class="method">${i === 0 ? esc(step.method) : esc(step.method)}${step.portal ? " · " + esc(step.portal) : ""}</div>
              <div class="method">${how}</div>
            </div>
            <button type="button" class="ghost-btn" data-open-map="${esc(url)}" data-open-title="${esc(name)}">放大</button>
          </div>
          <button type="button" class="mapnav-card-map" data-open-map="${esc(url)}" data-open-title="${esc(name)}" title="点击放大">
            <img src="${esc(url)}" alt="${esc(name)}" loading="lazy" data-fb="${esc(fb || "")}" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}else{this.replaceWith(Object.assign(document.createElement('div'),{className:'item-sub',textContent:'暂无地图图片'}));}" />
          </button>
        </article>`;
      })
      .join("");
  }

  async function renderMapNav() {
    // Simplified: overview image only (see #mapnavView). No route dataset UI.
    return;
  }

  function normalizeHeadingText(t) {
    return String(t || "")
      .replace(/<[^>]+>/g, "")
      .replace(/[:：]\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function classifyTocStep(title) {
    const t = String(title || "").trim();
    const compact = t.replace(/\s+/g, "");
    // numbered flow lines / bare 流程
    if (/^流程\s*\d*\.?$/.test(t) || /^流程\d*\.?$/.test(compact)) return "flow";
    if (/^\d+[.、．]/.test(t) || /^[一二三四五六七八九十]+[、.]/.test(t)) return "flow";
    if (/^流程/.test(t) && (t.length <= 8 || /流程\s*\d/.test(t))) return "flow";
    // map / quest / area headers
    if (/地图|分布|一览|任务列表|任务推荐|任务$|副本/.test(t)) return "section";
    if (/地图分布|任务列表/.test(t)) return "section";
    return "section";
  }

  function renderLevelToc(steps) {
    if (!el.levelToc) return;
    if (!steps.length) {
      el.levelToc.innerHTML = `<div class="level-toc-title">段落 / 步骤提要</div><div class="level-toc-empty">本文较少小标题，直接看正文即可。</div>`;
      return;
    }
    const items = steps.map((s, i) => ({
      i,
      title: s.title || "",
      kind: s.kind || "step",
      role: classifyTocStep(s.title),
    }));
    // nest consecutive flow items under the nearest preceding section
    let html = `<div class="level-toc-title">段落 / 步骤提要</div><ul class="level-toc-list">`;
    let openFlow = false;
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      if (it.role === "section") {
        if (openFlow) {
          html += `</ul></li>`;
          openFlow = false;
        }
        // peek if following are flow -> wrap children
        let hasKids = false;
        for (let j = n + 1; j < items.length; j++) {
          if (items[j].role === "section") break;
          if (items[j].role === "flow") {
            hasKids = true;
            break;
          }
        }
        const label = it.role === "section" ? ( /地图|分布|一览/.test(it.title) ? "地图" : /任务|副本/.test(it.title) ? "任务" : "地区" ) : "段落";
        html += `<li class="toc-section"><a href="#guide-step-${it.i}" data-guide-jump="${it.i}" class="toc-link toc-section-link"><span class="k">${esc(label)}</span>${esc(it.title)}</a>`;
        if (hasKids) {
          html += `<ul class="toc-flow-list">`;
          openFlow = true;
        } else {
          html += `</li>`;
        }
      } else {
        // flow
        if (!openFlow) {
          // orphan flow at start: put under synthetic group
          html += `<li class="toc-section toc-orphan"><span class="toc-orphan-label">流程</span><ul class="toc-flow-list">`;
          openFlow = true;
        }
        const short = it.title.length > 28 ? it.title.slice(0, 28) + "…" : it.title;
        html += `<li class="toc-flow"><a href="#guide-step-${it.i}" data-guide-jump="${it.i}" class="toc-link toc-flow-link"><span class="k">流程</span>${esc(short)}</a></li>`;
        // close if next is section or end
        const next = items[n + 1];
        if (!next || next.role === "section") {
          html += `</ul></li>`;
          openFlow = false;
        }
      }
    }
    if (openFlow) html += `</ul></li>`;
    html += `</ul>`;
    el.levelToc.innerHTML = html;
  }

  function annotateGuideHeadings(root, steps) {
    if (!root || !steps.length) return;
    const heads = [...root.querySelectorAll("h1, h2, h3, h4")];
    const used = new Set();
    steps.forEach((s, i) => {
      const want = normalizeHeadingText(s.title);
      if (!want) return;
      let hitIdx = heads.findIndex(
        (h, idx) => !used.has(idx) && normalizeHeadingText(h.textContent) === want
      );
      if (hitIdx < 0) {
        hitIdx = heads.findIndex(
          (h, idx) =>
            !used.has(idx) &&
            (normalizeHeadingText(h.textContent).includes(want) ||
              want.includes(normalizeHeadingText(h.textContent)))
        );
      }
      if (hitIdx >= 0) {
        used.add(hitIdx);
        heads[hitIdx].id = `guide-step-${i}`;
      }
    });
  }

  let tocObserver = null;
  function bindTocObserver(steps) {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
    if (!el.levelToc || !steps.length) return;
    const links = [...el.levelToc.querySelectorAll("[data-guide-jump]")];
    const map = new Map();
    links.forEach((a) => {
      const id = `guide-step-${a.dataset.guideJump}`;
      const node = document.getElementById(id);
      if (node) map.set(node, a);
    });
    if (!map.size) return;
    tocObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const a = map.get(visible[0].target);
        if (!a) return;
        links.forEach((x) => x.classList.toggle("active", x === a));
      },
      { rootMargin: "-12% 0px -70% 0px", threshold: [0, 0.1, 1] }
    );
    map.forEach((_, node) => tocObserver.observe(node));
  }

  function jumpToGuideStep(index) {
    const art = document.getElementById("guideArticle");
    const btn = el.levelMain && el.levelMain.querySelector('[data-level-nav="toggle-article"]');
    if (!state.leveling.showArticle) {
      state.leveling.showArticle = true;
      if (art) art.classList.remove("guide-collapsed");
      if (btn) btn.textContent = "收起全文";
    }
    const target = document.getElementById(`guide-step-${index}`);
    if (!target) {
      if (art) art.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("guide-step-flash");
    setTimeout(() => target.classList.remove("guide-step-flash"), 900);
    if (el.levelToc) {
      el.levelToc.querySelectorAll("[data-guide-jump]").forEach((a) => {
        a.classList.toggle("active", Number(a.dataset.guideJump) === Number(index));
      });
    }
  }

  const AREA_KEYWORDS = [
    "金银岛", "魔法密林", "勇士部落", "废弃都市", "明珠港", "射手村", "林中之城",
    "玩具城", "玩具塔", "地球防御总部", "水上市场", "泰国",
    "天空之城", "通天塔", "冰峰雪域", "冰封雪域", "埃尔纳斯",
    "黄金海岸", "百草堂", "武陵", "童话村", "玛加提亚", "阿里安特",
    "神木村", "时间神殿", "扎昆", "诺特勒斯", "艾琳森林", "副本", "远征"
  ];

  function extractAreaShortcuts(bracket) {
    const steps = bracket.steps || [];
    const texts = [
      ...steps.map((s) => s.title || ""),
      ...((bracket.mentioned || [])
        .filter((m) => m.type === "map")
        .map((m) => `${m.region || ""} ${m.name || ""}`)),
      bracket.title || "",
      bracket.summary || "",
    ];
    const blob = texts.join("\n");
    const out = [];
    const seen = new Set();
    for (const kw of AREA_KEYWORDS) {
      if (!blob.includes(kw) || seen.has(kw)) continue;
      seen.add(kw);
      const stepIndex = steps.findIndex((s) => (s.title || "").includes(kw));
      out.push({ label: kw, stepIndex: stepIndex >= 0 ? stepIndex : null, query: kw });
      if (out.length >= 16) break;
    }
    return out;
  }

  function renderAreaShortcuts(bracket) {
    const box = document.getElementById("areaShortcuts");
    if (!box) return;
    const items = extractAreaShortcuts(bracket);
    if (!items.length) {
      box.innerHTML = `<span class="item-sub">本篇暂无地区快捷入口</span>`;
      return;
    }
    box.innerHTML = items
      .map(
        (it) =>
          `<button type="button" class="area-chip" data-area-jump="${esc(it.label)}" data-step-index="${
            it.stepIndex == null ? "" : it.stepIndex
          }">${esc(it.label)}</button>`
      )
      .join("");
  }

  function clearGuideHighlights(root) {
    if (!root) return;
    root.querySelectorAll("mark.guide-hit").forEach((m) => {
      const text = document.createTextNode(m.textContent);
      m.replaceWith(text);
    });
    root.normalize();
  }

  function findInGuide(query, fromIndex) {
    const body = document.getElementById("guideBody");
    if (!body) return -1;
    const q = String(query || "").trim();
    if (!q) return -1;
    if (!state.leveling.showArticle) {
      state.leveling.showArticle = true;
      const art = document.getElementById("guideArticle");
      if (art) art.classList.remove("guide-collapsed");
      const btn = el.levelMain && el.levelMain.querySelector('[data-level-nav="toggle-article"]');
      if (btn) btn.textContent = "收起全文";
    }
    clearGuideHighlights(body);
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.nodeValue && n.nodeValue.includes(q)) nodes.push(n);
    }
    if (!nodes.length) {
      const st = document.getElementById("guideFindStatus");
      if (st) st.textContent = `未找到「${q}」`;
      return -1;
    }
    const start = Math.max(0, Number(fromIndex) || 0) % nodes.length;
    // highlight all, focus start
    nodes.forEach((n) => {
      const text = n.nodeValue;
      const frag = document.createDocumentFragment();
      let i = 0;
      while (true) {
        const at = text.indexOf(q, i);
        if (at < 0) {
          frag.appendChild(document.createTextNode(text.slice(i)));
          break;
        }
        if (at > i) frag.appendChild(document.createTextNode(text.slice(i, at)));
        const mark = document.createElement("mark");
        mark.className = "guide-hit";
        mark.textContent = q;
        frag.appendChild(mark);
        i = at + q.length;
      }
      n.parentNode.replaceChild(frag, n);
    });
    const marks = [...body.querySelectorAll("mark.guide-hit")];
    const focus = marks[Math.min(start, marks.length - 1)];
    if (focus) {
      focus.classList.add("guide-hit-focus");
      focus.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    state.leveling.findQuery = q;
    state.leveling.findIndex = (start + 1) % Math.max(marks.length, 1);
    const st = document.getElementById("guideFindStatus");
    if (st) st.textContent = `第 ${start + 1}/${marks.length} 处`;
    return start;
  }

  function jumpArea(label, stepIndex) {
    if (stepIndex !== "" && stepIndex != null && !Number.isNaN(Number(stepIndex))) {
      jumpToGuideStep(Number(stepIndex));
      return;
    }
    findInGuide(label, 0);
  }


  async function renderLeveling() {
    if (!state.leveling.ready) {
      el.levelMain.innerHTML = `<div class="loading">正在加载升级攻略…</div>`;
      renderLevelToc([]);
      return;
    }
    renderBracketNav();
    const b = getActiveBracket();
    if (!b) {
      el.levelMain.innerHTML = `<div class="loading">没有可用攻略</div>`;
      renderLevelToc([]);
      return;
    }
    const lv = state.leveling.level;
    const inRange = lv >= b.levelMin && lv <= b.levelMax;
    const { prev, next } = getPrevNext(b);
    const jobNote = state.leveling.job
      ? `<div class="meta-line">当前职业备注：${esc(state.leveling.job)}（攻略多为通用，请自行对照职业）</div>`
      : "";

    const steps = (b.steps || []).slice(0, 40);
    const tips = (b.tips || []).slice(0, 12);
    renderLevelToc(steps);
    renderAreaShortcuts(b);

    el.levelMain.innerHTML = `
      <div class="level-card-head">
        <h2>${esc(b.title)}</h2>
        <span class="level-range">${b.kind === "hub" ? "通用参考" : `Lv.${b.levelMin}–${b.levelMax}`}${inRange ? " · 当前等级落在此段" : ""}</span>
      </div>
      ${inRange ? `<div class="next-banner">下一步：按本段攻略推进（任务 / 刷怪 / 跳转）。点下方芯片可打开本地图鉴详情；右侧目录可快速跳段。</div>` : `<div class="next-banner">你输入的等级是 ${lv}；正在查看「${esc(b.title)}」。可用上方芯片切换，或改等级后点「查看路线」。右侧目录可快速跳段。</div>`}
      <div class="level-summary">${esc(b.summary || "")}</div>
      ${jobNote}
      <div class="level-actions">
        <button type="button" class="ghost-btn" data-level-nav="prev" ${prev ? "" : "disabled"}>← ${prev ? esc(prev.title) : "没有上一段"}</button>
        <button type="button" class="ghost-btn" data-level-nav="next" ${next ? "" : "disabled"}>${next ? esc(next.title) : "没有下一段"} →</button>
        <button type="button" class="ghost-btn" data-level-nav="toggle-article">${state.leveling.showArticle ? "收起全文" : "展开全文"}</button>
        <a class="ghost-btn" href="${esc(b.sourceUrl)}" target="_blank" rel="noopener">来源原文</a>
      </div>
      <div class="section"><h3>推荐动作（摘录）</h3>
        ${tips.length ? `<ul class="tip-list">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<div class="item-sub">无摘录</div>`}
      </div>
      <div class="section"><h3>关联怪物</h3>${mentionPills(b.mentioned, ["monster"])}</div>
      <div class="section"><h3>关联地图</h3>${mentionPills(b.mentioned, ["map"])}</div>
      <div class="section"><h3>关联任务</h3>${mentionPills(b.mentioned, ["quest"])}</div>
      <div class="section"><h3>关联 NPC</h3>${mentionPills(b.mentioned, ["npc"])}</div>
      <div class="section"><h3>关联道具（部分）</h3>${mentionPills(b.mentioned, ["item"])}</div>
      <div class="guide-article ${state.leveling.showArticle ? "" : "guide-collapsed"}" id="guideArticle">
        <h3>攻略全文（含本地配图）</h3>
        <div class="guide-body" id="guideBody"><div class="loading">加载正文…</div></div>
      </div>
      <div class="muted-note">个人离线自用；来源 longlegmxd 升级攻略；配图含原站水印已保留。可能与 WingsMS 不一致。任务图鉴条目数可能少于 MapleHelper，完整任务导入见 README TODO。</div>
    `;

    try {
      const html = await ensureArticle(b);
      const body = document.getElementById("guideBody");
      if (body) {
        body.innerHTML = html;
        annotateGuideHeadings(body, steps);
        bindTocObserver(steps);
      }
    } catch (e) {
      const body = document.getElementById("guideBody");
      if (body) body.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    }
  }

  // events
  renderTypeFilters();

  el.typeFilters.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    state.type = btn.dataset.type;
    state.homePage = 0;
    renderTypeFilters();
    if (state.view === "home") renderHome();
  });

  el.viewTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  let timer = null;
  el.q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.query = el.q.value;
      state.homePage = 0;
      state.browsePage = 0;
      if (state.view === "browse") renderBrowse();
      else renderHome();
    }, 120);
  });

  function onListClick(e) {
    const pager = e.target.closest("[data-pager]");
    if (pager && e.target.matches("button[data-act]")) {
      const which = pager.dataset.pager;
      const act = e.target.dataset.act;
      if (which === "home") {
        state.homePage += act === "next" ? 1 : -1;
        renderHome();
      } else {
        state.browsePage += act === "next" ? 1 : -1;
        renderBrowse();
      }
      return;
    }
    const node = e.target.closest("[data-key]");
    if (node) openRecord(node.dataset.key);
  }

  el.resultList.addEventListener("click", onListClick);
  el.browseList.addEventListener("click", onListClick);
  el.detailPanel.addEventListener("click", onListClick);
  el.browseDetail.addEventListener("click", onListClick);

  el.browseCards.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-browse]");
    if (!btn) return;
    state.browseType = btn.dataset.browse;
    state.browsePage = 0;
    state.selectedKey = null;
    renderBrowse();
  });

  function applyLevelFromInputs() {
    const lv = Number(el.levelInput.value) || 1;
    state.leveling.job = (el.jobInput.value || "").trim();
    pickBracketForLevel(lv);
    renderLeveling();
  }

  el.levelGo.addEventListener("click", applyLevelFromInputs);
  if (el.guideFindGo) {
    el.guideFindGo.addEventListener("click", () => {
      const q = (el.guideFind && el.guideFind.value) || state.leveling.findQuery || "";
      findInGuide(q, state.leveling.findQuery === q ? state.leveling.findIndex : 0);
    });
  }
  if (el.guideFind) {
    el.guideFind.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = el.guideFind.value || "";
        findInGuide(q, state.leveling.findQuery === q ? state.leveling.findIndex : 0);
      }
    });
  }
  const areaBox = document.getElementById("areaShortcuts");
  if (areaBox) {
    areaBox.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-area-jump]");
      if (!btn) return;
      jumpArea(btn.dataset.areaJump, btn.dataset.stepIndex);
    });
  }

  el.levelInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyLevelFromInputs();
  });
  el.bracketNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bracket]");
    if (!btn) return;
    state.leveling.activeId = Number(btn.dataset.bracket);
    renderLeveling();
  });
  if (el.levelToc) {
    el.levelToc.addEventListener("click", (e) => {
      const a = e.target.closest("[data-guide-jump]");
      if (!a) return;
      e.preventDefault();
      jumpToGuideStep(Number(a.dataset.guideJump));
    });
  }

  el.levelMain.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-level-nav]");
    if (nav) {
      const act = nav.dataset.levelNav;
      const b = getActiveBracket();
      if (!b) return;
      if (act === "toggle-article") {
        state.leveling.showArticle = !state.leveling.showArticle;
        renderLeveling();
        return;
      }
      const { prev, next } = getPrevNext(b);
      if (act === "prev" && prev) state.leveling.activeId = prev.id;
      if (act === "next" && next) state.leveling.activeId = next.id;
      renderLeveling();
      return;
    }
    const node = e.target.closest("[data-key]");
    if (node) openRecord(node.dataset.key);
  });
  if (el.levelDetail) el.levelDetail.addEventListener("click", onListClick);
  if (el.levelDetailClose) el.levelDetailClose.addEventListener("click", closeLevelDetail);
  if (el.levelDetailBackdrop) el.levelDetailBackdrop.addEventListener("click", closeLevelDetail);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.levelDetail && !el.levelDetail.hidden) closeLevelDetail();
  });

  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
  syncThemeButton();


  // map lightbox + mapnav events
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-map]");
    if (openBtn) {
      openMapLightbox(openBtn.dataset.openMap, openBtn.dataset.openTitle || "地图");
      return;
    }
    const navFrom = e.target.closest("[data-nav-from-map]");
    if (navFrom) {
      state.mapnav.startId = navFrom.dataset.navFromMap;
      setView("mapnav");
      refreshNavPickers();
      updateNavPreview(state.mapnav.startId);
      return;
    }
  });
  const lb = document.getElementById("mapLightbox");
  const lbClose = document.getElementById("mapLightboxClose");
  const lbStage = document.getElementById("mapLightboxStage");
  if (lbClose) lbClose.addEventListener("click", closeMapLightbox);
  if (lb) {
    lb.querySelectorAll("[data-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const z = btn.dataset.zoom;
        if (z === "+") mapLb.scale = Math.min(8, mapLb.scale * 1.25);
        else if (z === "-") mapLb.scale = Math.max(0.4, mapLb.scale / 1.25);
        else {
          mapLb.scale = 1;
          mapLb.x = 0;
          mapLb.y = 0;
        }
        applyLightboxTransform();
      });
    });
  }
  if (lbStage) {
    lbStage.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        mapLb.scale = Math.min(8, Math.max(0.4, mapLb.scale * factor));
        applyLightboxTransform();
      },
      { passive: false }
    );
    lbStage.addEventListener("pointerdown", (e) => {
      mapLb.dragging = true;
      mapLb.px = e.clientX;
      mapLb.py = e.clientY;
      lbStage.classList.add("dragging");
      lbStage.setPointerCapture(e.pointerId);
    });
    lbStage.addEventListener("pointermove", (e) => {
      if (!mapLb.dragging) return;
      mapLb.x += e.clientX - mapLb.px;
      mapLb.y += e.clientY - mapLb.py;
      mapLb.px = e.clientX;
      mapLb.py = e.clientY;
      applyLightboxTransform();
    });
    lbStage.addEventListener("pointerup", () => {
      mapLb.dragging = false;
      lbStage.classList.remove("dragging");
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMapLightbox();
  });

  function bindNavPicker(id, onChange) {
    const node = document.getElementById(id);
    if (node) node.addEventListener("change", onChange);
    if (node && node.tagName === "INPUT") node.addEventListener("input", onChange);
  }
  const refreshStart = () => {
    refreshNavPickers();
  };
  bindNavPicker("navStartMajor", refreshStart);
  bindNavPicker("navStartArea", refreshStart);
  bindNavPicker("navStartSearch", refreshStart);
  bindNavPicker("navEndMajor", refreshStart);
  bindNavPicker("navEndArea", refreshStart);
  bindNavPicker("navEndSearch", refreshStart);
  bindNavPicker("navStartMap", () => {
    const sel = document.getElementById("navStartMap");
    state.mapnav.startId = sel.value;
    updateNavPreview(sel.value);
  });
  bindNavPicker("navEndMap", () => {
    const sel = document.getElementById("navEndMap");
    state.mapnav.endId = sel.value;
  });
  const routeBtn = document.getElementById("navRouteBtn");
  if (routeBtn) routeBtn.addEventListener("click", renderNavRoute);
  const swapBtn = document.getElementById("navSwapBtn");
  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const a = state.mapnav.startId;
      state.mapnav.startId = state.mapnav.endId;
      state.mapnav.endId = a;
      refreshNavPickers();
      updateNavPreview(state.mapnav.startId);
      renderNavRoute();
    });
  }
  const preview = document.getElementById("navPreview");
  if (preview) {
    preview.addEventListener("click", () => {
      if (preview.dataset.url) openMapLightbox(preview.dataset.url, preview.dataset.title || "地图");
    });
  }



  const guidesCats = document.getElementById("guidesCats");
  if (guidesCats) {
    guidesCats.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-guide-cat]");
      if (!btn) return;
      state.guides.catId = btn.dataset.guideCat;
      state.guides.query = "";
      const gs = document.getElementById("guidesSearch");
      if (gs) gs.value = "";
      renderGuidesCats();
      renderGuidesList();
    });
  }
  const guidesList = document.getElementById("guidesList");
  if (guidesList) {
    guidesList.addEventListener("click", (e) => {
      const special = e.target.closest("[data-guide-special]");
      if (special) {
        setView(special.dataset.guideSpecial);
        return;
      }
      const item = e.target.closest("[data-guide-open]");
      if (!item) return;
      openGuideArticle(item.dataset.guideOpen, item.dataset.guideTitle, item.dataset.guideSrc);
    });
  }
  const guidesBack = document.getElementById("guidesBack");
  if (guidesBack) guidesBack.addEventListener("click", () => { showGuidesList(); renderGuidesList(); });
  const guidesSearch = document.getElementById("guidesSearch");
  if (guidesSearch) {
    guidesSearch.addEventListener("input", () => {
      const cat = currentGuideCat();
      if (cat && cat.special === "jobquests") {
        state.jobquests.query = guidesSearch.value;
        const hiddenQ = document.getElementById("jobquestsSearch");
        if (hiddenQ) hiddenQ.value = guidesSearch.value;
        if (state.jobquests.data) renderJobQuestsBody(state.jobquests.data);
        const jqStatus = document.getElementById("jobquestsStatus");
        const status = document.getElementById("guidesStatus");
        if (status && jqStatus && jqStatus.textContent) status.textContent = jqStatus.textContent;
        return;
      }
      state.guides.query = guidesSearch.value;
      renderGuidesList();
    });
  }

  const jobquestsCats = document.getElementById("jobquestsCats");
  if (jobquestsCats) {
    jobquestsCats.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-job-chain]");
      if (!btn) return;
      state.jobquests.chain = btn.dataset.jobChain;
      if (state.jobquests.data) {
        renderJobQuestsCats(state.jobquests.data);
        renderJobQuestsBody(state.jobquests.data);
        const jqStatus = document.getElementById("jobquestsStatus");
        const status = document.getElementById("guidesStatus");
        if (status && jqStatus && jqStatus.textContent) status.textContent = jqStatus.textContent;
      }
    });
  }
  const jobquestsSearch = document.getElementById("jobquestsSearch");
  if (jobquestsSearch) {
    jobquestsSearch.addEventListener("input", () => {
      state.jobquests.query = jobquestsSearch.value;
      if (state.jobquests.data) renderJobQuestsBody(state.jobquests.data);
    });
  }


  boot();
})();
