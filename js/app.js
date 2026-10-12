/* 모카 키우기 일지 — 앱 본체 (Vanilla JS) */
(function () {
  const D = window.MocaData;
  const cfg = window.MOCA_CONFIG || {};
  const $ = (sel, el = document) => el.querySelector(sel);
  const view = $("#view");
  const state = { ctx: null, terms: localStorage.getItem("moca.terms") || "easy", logs: null, checklist: null, badges: null };

  // ---------- 날짜 ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => toStr(new Date());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const dayIndex = (date) => daysBetween(state.ctx.pet.adopted_at, date); // 입양일 = 0
  const dayCount = (date) => dayIndex(date) + 1; // 입양 1일차
  const fmtK = (s) => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})`; };

  // ---------- 용어 ----------
  const TERMS = {
    feed: ["밥", "급여"], mist: ["물 뿌리기", "분무"], poop: ["응가", "배변"], shed: ["허물 벗기", "탈피"],
    shedding: ["벗는 중", "탈피 중"], shed_done: ["다 벗음", "탈피 완료"], weight: ["몸무게", "체중"],
  };
  const T = (k) => { const [e, f] = TERMS[k]; return state.terms === "easy" ? `${e}(${f})` : f; };
  const Tshort = (k) => { const [e, f] = TERMS[k]; return state.terms === "easy" ? e : f; };

  // ---------- 체크리스트 정의 ----------
  const CHECK_ITEMS = () => [
    { key: "mist", label: T("mist"), why: "크레스티드 게코는 물그릇보다 잎에 맺힌 물방울을 핥아 마셔요. 아침·저녁에 사육장 벽과 잎에 물을 뿌려 주세요." },
    { key: "temp", label: "온도·습도 확인", why: "적정 온도 22~26℃, 습도 60~80%. 너무 더우면(28℃ 이상) 위험해요. 온습도계가 생기면 숫자로 기록해요." },
    { key: "water", label: "물그릇 확인", why: "물은 매일 갈아 주세요. 분무를 해도 물그릇은 있어야 해요." },
    { key: "observe", label: "모카 살펴보기", why: "눈이 맑은지, 피부에 허물이 남아 있지 않은지, 꼬리와 발가락이 괜찮은지 살짝 봐요. 억지로 만지지 않아도 돼요." },
  ];
  const FEED_ITEM = () => ({ key: "feed", label: `${T("feed")} 주기`, why: "어린 모카는 2일에 한 번 밥을 먹어요. 파우더 푸드를 물에 개서 주고, 밀웜은 가끔 간식으로만 주세요. 다음 날 아침에 남은 밥은 치워요." });
  const SUPPLIES = [
    { key: "cage", label: "사육장", why: "세로로 긴 사육장(높이 45cm 이상)이 좋아요. 모카는 위로 올라가는 걸 좋아해요." },
    { key: "hygrometer", label: "온습도계", why: "온습도계가 생기면 기록 화면에 숫자 입력 칸이 열려요." },
    { key: "powder", label: "파우더 푸드", why: "크레스티드 게코 전용 파우더 푸드가 주식이에요. 밀웜만 먹이면 영양이 부족해요." },
  ];
  const BADGES = [
    { key: "first_log", ico: "🌱", name: "첫 기록", desc: "모카 일지를 처음 썼어요" },
    { key: "ready", ico: "🧰", name: "준비 완료", desc: "사육장·온습도계·파우더 푸드를 다 갖췄어요" },
    { key: "first_weight", ico: "⚖️", name: "첫 몸무게", desc: "모카 몸무게를 처음 쟀어요" },
    { key: "streak_7", ico: "🔥", name: "7일 연속", desc: "일주일 동안 매일 기록했어요" },
    { key: "first_shed", ico: "🧥", name: "첫 허물", desc: "모카가 허물 벗는 걸 처음 기록했어요" },
    { key: "photos_10", ico: "📸", name: "사진 10장", desc: "모카 사진을 10장 모았어요" },
    { key: "streak_30", ico: "🏆", name: "30일 연속", desc: "한 달 동안 매일 기록했어요" },
    { key: "day_100", ico: "🎂", name: "100일", desc: "모카와 함께한 지 100일!" },
  ];
  const MOODS = ["😴", "😐", "🙂", "😄", "🤩"];
  const MOOD_NAMES = ["졸려", "그냥", "괜찮아", "신나", "최고"];

  const isFeedDay = (date) => { const i = dayIndex(date); return i >= 0 && i % (state.ctx.pet.feed_interval_days || 2) === 0; };
  const itemsFor = (date) => (isFeedDay(date) ? [FEED_ITEM(), ...CHECK_ITEMS()] : CHECK_ITEMS());

  // ---------- 유틸 ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let toastTimer;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200); }
  function modal(html) { const m = $("#modal"); m.innerHTML = `<div class="sheet">${html}</div>`; m.hidden = false; m.onclick = (e) => { if (e.target === m) m.hidden = true; }; return m; }
  function closeModal() { $("#modal").hidden = true; }
  function confetti() {
    const colors = ["#e2834a", "#d9b77a", "#7fae5c", "#f0c9ae", "#b48c3f"];
    for (let i = 0; i < 40; i++) {
      const c = document.createElement("i"); c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw"; c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.6 + "s"; document.body.appendChild(c);
      setTimeout(() => c.remove(), 2600);
    }
  }
  function roleName(r) { return { child: "주 보호자", observer: "관찰자", admin: "관리자" }[r] || r; }
  const memberName = (id) => (state.ctx.members.find((m) => m.id === id) || {}).nickname || "?";

  async function resizeImage(file, max = 1280) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
  }

  // ---------- 데이터 캐시 ----------
  async function loadAll() {
    const [logs, checklist, badges] = await Promise.all([D.getLogs(), D.getChecklistAll(), D.getBadges()]);
    state.logs = logs; state.checklist = checklist; state.badges = badges;
  }
  const logOf = (date) => state.logs.find((l) => l.log_date === date);
  const checksOf = (date) => state.checklist.filter((c) => c.log_date === date);
  const childIds = () => { const ids = state.ctx.members.filter((m) => m.role === "child").map((m) => m.id); return ids.length ? ids : state.ctx.members.map((m) => m.id); };
  const isChildLog = (l) => childIds().includes(l.member_id);

  function dayLevel(date) {
    const l = logOf(date); const cs = checksOf(date); const items = itemsFor(date);
    const done = cs.filter((c) => c.done).length;
    if (!l && done === 0) return 0;
    const ratio = items.length ? done / items.length : 0;
    // 기록이 있으면 1~4단계(체크 완료도에 따라), 체크만 했으면 1~3단계
    return l ? Math.min(4, 1 + Math.round(ratio * 3)) : Math.max(1, Math.round(ratio * 3));
  }
  function streak() {
    let date = todayStr(); let n = 0;
    const has = (d) => { const l = logOf(d); return l && isChildLog(l); };
    if (!has(date)) date = addDays(date, -1);
    while (has(date)) { n++; date = addDays(date, -1); }
    return n;
  }

  // ---------- 뱃지 ----------
  async function evaluateBadges() {
    const have = new Set(state.badges.filter((b) => b.member_id === state.ctx.me.id).map((b) => b.badge_key));
    const earn = [];
    const myLogs = state.logs.filter((l) => l.member_id === state.ctx.me.id);
    if (myLogs.length >= 1) earn.push("first_log");
    if (state.logs.some((l) => l.weight_g != null)) earn.push("first_weight");
    if (state.logs.some((l) => l.shed_status && l.shed_status !== "none")) earn.push("first_shed");
    const s = streak(); if (s >= 7) earn.push("streak_7"); if (s >= 30) earn.push("streak_30");
    if (dayCount(todayStr()) >= 100) earn.push("day_100");
    const sup = await D.getSupplies(); if (SUPPLIES.every((x) => sup.find((y) => y.item_key === x.key && y.done))) earn.push("ready");
    const photos = await D.getAllPhotos(); if (photos.length >= 10) earn.push("photos_10");
    for (const key of earn) {
      if (have.has(key)) continue;
      const b = await D.awardBadge(key);
      if (b) { state.badges.push(b); celebrate(key); }
    }
  }
  function celebrate(key) {
    const b = BADGES.find((x) => x.key === key); if (!b) return;
    confetti();
    modal(`<div class="celebrate"><div class="big-ico">${b.ico}</div><h2>뱃지 획득!</h2><p class="jua" style="font-size:22px;margin:6px 0">${b.name}</p><p class="muted">${b.desc}</p><button class="btn primary block" onclick="document.getElementById('modal').hidden=true">신난다!</button></div>`);
  }

  // ---------- 라우팅 ----------
  function route() {
    const hash = location.hash.replace("#", "") || "today";
    const [tab, arg] = hash.split("/");
    document.querySelectorAll("#tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    const r = { today: renderToday, log: () => renderLog(arg || todayStr()), calendar: renderCalendar, pet: renderPet, family: renderFamily }[tab] || renderToday;
    r().catch((e) => { console.error(e); view.innerHTML = `<div class="card">문제가 생겼어요: ${esc(e.message)}</div>`; });
    window.scrollTo(0, 0);
  }

  // ---------- 합류 화면 ----------
  function renderJoin() {
    $("#tabbar").hidden = true;
    view.innerHTML = `
      <div class="join">
        <div class="hero-emoji">🦎</div>
        <h1>모카 일지</h1>
        ${D.mode === "demo" ? `<div class="banner">지금은 <b>데모 모드</b>예요. 이 폰에만 저장되고 가족과 공유되지 않아요. (config.js에 Supabase 설정을 넣으면 공유 모드가 돼요)</div>` : ""}
        <div class="card">
          <h3>초대 코드로 들어가기</h3>
          <div class="stack">
            <input type="text" id="j-code" placeholder="초대 코드 6자리" maxlength="6" autocapitalize="characters" style="text-align:center;font-size:22px;letter-spacing:6px" />
            <input type="text" id="j-nick" placeholder="내 이름 (예: 라진)" maxlength="12" />
            <div class="seg" id="j-role"><button data-v="child" class="on">내가 모카를 돌봐요</button><button data-v="observer">같이 지켜봐요</button></div>
            <button class="btn primary block" id="j-join">들어가기</button>
          </div>
        </div>
        <div class="card">
          <h3>처음이라면: 가족 만들기</h3>
          <p class="muted">어른(관리자) 한 명이 한 번만 만들면 돼요. 그 뒤 초대 코드를 가족에게 알려 주세요.</p>
          <div class="stack">
            <input type="text" id="c-nick" placeholder="내 이름 (예: 아빠)" maxlength="12" />
            <input type="text" id="c-fam" placeholder="가족 이름 (예: 라진이네)" maxlength="20" />
            <div class="inline"><input type="date" id="c-adopt" value="2026-10-11" /><input type="text" id="c-place" value="수원" placeholder="입양 장소" /></div>
            <div class="inline"><input type="number" id="c-age" placeholder="나이(개월, 어림)" min="0" /><select id="c-feed"><option value="1">매일 밥</option><option value="2" selected>2일에 한 번</option><option value="3">3일에 한 번</option></select></div>
            <button class="btn block" id="c-create">가족 만들기 (관리자)</button>
          </div>
        </div>
      </div>`;
    const roleSeg = $("#j-role"); roleSeg.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; roleSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
    $("#j-join").onclick = async () => {
      const code = $("#j-code").value.trim().toUpperCase(), nickname = $("#j-nick").value.trim();
      if (code.length !== 6 || !nickname) return toast("초대 코드 6자리와 이름을 적어 주세요");
      try { await D.joinFamily({ code, nickname, role: roleSeg.querySelector(".on").dataset.v }); await boot(); } catch (e) { toast(e.message); }
    };
    $("#c-create").onclick = async () => {
      const nickname = $("#c-nick").value.trim(), familyName = $("#c-fam").value.trim() || "우리 가족";
      if (!nickname) return toast("이름을 적어 주세요");
      const pet = { name: "모카", species: "크레스티드 게코", morph: "릴리 화이트", adopted_at: $("#c-adopt").value || todayStr(), adopted_place: $("#c-place").value.trim(),
        age_months_estimate: $("#c-age").value ? Number($("#c-age").value) : null, feed_interval_days: Number($("#c-feed").value) };
      try { const r = await D.createFamily({ familyName, nickname, pet }); toast("초대 코드: " + r.invite_code); await boot(); location.hash = "#family"; } catch (e) { toast(e.message); }
    };
  }

  // ---------- 오늘 ----------
  async function renderToday() {
    await loadAll();
    const today = todayStr(); const log = logOf(today); const items = itemsFor(today); const cs = checksOf(today);
    const done = items.filter((it) => cs.find((c) => c.item_key === it.key && c.done)).length;
    const sup = await D.getSupplies(); const missing = SUPPLIES.filter((s) => !sup.find((x) => x.item_key === s.key && x.done));
    const hour = new Date().getHours(); const remind = !log && hour >= (cfg.REMINDER_HOUR ?? 20);
    const photos = await D.getAllPhotos(); const lastPhoto = photos[photos.length - 1];
    const s = streak();
    view.innerHTML = `
      ${remind ? `<div class="banner">🌙 오늘 모카 기록 아직 안 했어요. 자기 전에 한 줄만 남겨 볼까요?</div>` : ""}
      <div class="card">
        <div class="hero">
          <div class="avatar">${lastPhoto ? `<img src="${lastPhoto.url}" alt="모카" />` : "🦎"}</div>
          <div>
            <div class="big">${esc(state.ctx.pet.name)}와 함께한 지<br/><span style="color:var(--accent)">${dayCount(today)}일째</span></div>
            <div class="muted">${esc(state.ctx.pet.morph)} · ${state.ctx.pet.age_months_estimate ? `약 ${state.ctx.pet.age_months_estimate}개월` : "어린 모카"}</div>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><b>${s}</b><span>연속 기록 🔥</span></div>
          <div class="stat"><b>${state.logs.length}</b><span>기록한 날</span></div>
          <div class="stat"><b>${state.badges.length}</b><span>뱃지</span></div>
        </div>
      </div>
      ${missing.length ? `<div class="card"><h3>🧰 아직 준비 중인 것</h3><p class="muted">사면 체크해 주세요. 다 모으면 뱃지!</p>
        ${SUPPLIES.map((x) => { const d = sup.find((y) => y.item_key === x.key && y.done); return `<div class="check ${d ? "done" : ""}" data-sup="${x.key}"><div class="box">✓</div><div class="label">${x.label}</div><button class="why" data-why="s-${x.key}">왜?</button></div><div class="why-text" id="why-s-${x.key}" hidden>${x.why}</div>`; }).join("")}
      </div>` : ""}
      <div class="card">
        <div class="row between"><h3>☀️ 오늘의 할 일</h3><span class="chip ${done === items.length ? "accent" : ""}">${done}/${items.length}</span></div>
        <div class="progress"><div style="width:${items.length ? (done / items.length) * 100 : 0}%"></div></div>
        ${isFeedDay(today) ? `<p class="muted">오늘은 ${Tshort("feed")} 주는 날이에요 🍽️</p>` : `<p class="muted">오늘은 ${Tshort("feed")} 쉬는 날. 다음 ${Tshort("feed")}은 ${fmtK(nextFeedDay(today))}</p>`}
        ${items.map((it) => { const d = cs.find((c) => c.item_key === it.key && c.done); return `<div class="check ${d ? "done" : ""}" data-check="${it.key}"><div class="box">✓</div><div class="label">${it.label}${d && d.done_by && d.done_by !== state.ctx.me.id ? `<span class="muted"> · ${esc(memberName(d.done_by))}</span>` : ""}</div><button class="why" data-why="c-${it.key}">왜?</button></div><div class="why-text" id="why-c-${it.key}" hidden>${it.why}</div>`; }).join("")}
      </div>
      <div class="card">
        <div class="row between"><h3>✏️ 오늘 모카는?</h3>${log ? `<span class="chip">${esc(memberName(log.member_id))}이(가) 기록</span>` : ""}</div>
        ${log ? logSummary(log) : `<p class="muted">아직 기록이 없어요. 모카는 오늘 뭐 했을까?</p>`}
        <a class="btn primary block" href="#log/${today}" style="margin-top:10px">${log ? "기록 고치기" : "오늘 기록하기"}</a>
      </div>`;
    view.onclick = async (e) => {
      const why = e.target.closest("[data-why]"); if (why) { const el = $("#why-" + why.dataset.why); el.hidden = !el.hidden; return; }
      const chk = e.target.closest("[data-check]");
      if (chk) { const on = !chk.classList.contains("done"); await D.setChecklist(today, chk.dataset.check, on); await renderToday(); if (on && itemsFor(today).every((it) => checksOf(today).find((c) => c.item_key === it.key && c.done))) toast("오늘 할 일 다 했어요! 🎉"); return; }
      const sp = e.target.closest("[data-sup]");
      if (sp) { await D.setSupply(sp.dataset.sup, !sp.classList.contains("done")); await evaluateBadges(); await renderToday(); }
    };
  }
  function nextFeedDay(from) { let d = addDays(from, 1); for (let i = 0; i < 7; i++) { if (isFeedDay(d)) return d; d = addDays(d, 1); } return d; }
  function logSummary(l) {
    const bits = [];
    if (l.fed != null) bits.push(l.fed ? `🍽️ ${Tshort("feed")} ${({ all: "다 먹음", some: "조금 먹음", none: "안 먹음" })[l.eaten] || ""}` : `🍽️ ${Tshort("feed")} 안 줌`);
    if (l.misted_am || l.misted_pm) bits.push(`💧 ${Tshort("mist")} ${[l.misted_am && "아침", l.misted_pm && "저녁"].filter(Boolean).join("·")}`);
    if (l.temp_c != null || l.humidity_pct != null) bits.push(`🌡️ ${l.temp_c != null ? l.temp_c + "℃" : ""} ${l.humidity_pct != null ? l.humidity_pct + "%" : ""}`);
    else { if (l.temp_level) bits.push(`🌡️ ${lv(l.temp_level)}`); if (l.humidity_level) bits.push(`💦 ${lv(l.humidity_level)}`); }
    if (l.defecated) bits.push(`💩 ${Tshort("poop")}`);
    if (l.shed_status && l.shed_status !== "none") bits.push(`🧥 ${l.shed_status === "shedding" ? Tshort("shedding") : Tshort("shed_done")}`);
    if (l.weight_g != null) bits.push(`⚖️ ${l.weight_g}g${l.weight_is_estimate ? " (어림)" : ""}`);
    if (l.mood != null) bits.push(`${MOODS[l.mood]} ${MOOD_NAMES[l.mood]}`);
    return `<div class="row" style="flex-wrap:wrap">${bits.map((b) => `<span class="chip">${b}</span>`).join("")}</div>${l.note ? `<p style="margin:8px 0 0">“${esc(l.note)}”</p>` : ""}`;
  }
  const lv = (v) => ({ low: "낮음", ok: "적정", high: "높음" })[v] || "-";

  // ---------- 기록하기 ----------
  async function renderLog(date) {
    if (!state.logs) await loadAll();
    if (date > todayStr()) { toast("미래는 아직 기록할 수 없어요"); location.hash = "#today"; return; }
    const log = logOf(date) || {};
    const sup = await D.getSupplies(); const hasHygro = !!sup.find((x) => x.item_key === "hygrometer" && x.done);
    const hasPowder = !!sup.find((x) => x.item_key === "powder" && x.done);
    const feedDay = isFeedDay(date);
    const f = { fed: log.fed ?? (feedDay ? true : null), food_type: log.food_type || null, food_amount: log.food_amount || null, eaten: log.eaten || null,
      misted_am: !!log.misted_am, misted_pm: !!log.misted_pm, temp_level: log.temp_level || null, humidity_level: log.humidity_level || null,
      temp_c: log.temp_c ?? "", humidity_pct: log.humidity_pct ?? "", defecated: log.defecated ?? null, shed_status: log.shed_status || "none",
      weight_g: log.weight_g ?? "", weight_is_estimate: !!log.weight_is_estimate, mood: log.mood ?? null, note: log.note || "" };
    const seg = (name, opts, cur, extra = "") => `<div class="seg ${extra}" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const photos = log.id ? await D.getPhotos(log.id) : [];
    view.innerHTML = `
      <div class="row between" style="margin-bottom:10px"><h2>${date === todayStr() ? "오늘" : fmtK(date)} 기록</h2><span class="chip">${dayCount(date)}일째</span></div>
      <div class="card" ${feedDay ? "" : 'id="feed-card"'}>
        <div class="field"><label>🍽️ ${T("feed")} ${feedDay ? "" : '<span class="muted">(오늘은 쉬는 날)</span>'}</label>
          ${seg("fed", [["true", "줬어요"], ["false", "안 줬어요"]], f.fed)}</div>
        <div id="feed-detail" ${f.fed === true ? "" : "hidden"}>
          <div class="field"><label>무엇을?</label>${seg("food_type", [["mealworm", "밀웜"], ["powder", hasPowder ? "파우더 푸드" : "파우더 푸드 (아직 없음)"], ["fruit", "과일"]], f.food_type)}</div>
          <div class="field"><label>얼마나?</label>${seg("food_amount", [["little", "조금"], ["normal", "보통"], ["much", "많이"]], f.food_amount)}</div>
          <div class="field"><label>모카가 먹었나요?</label>${seg("eaten", [["all", "다 먹음"], ["some", "조금"], ["none", "안 먹음"], ["unknown", "모름"]], f.eaten)}</div>
        </div>
      </div>
      <div class="card">
        <div class="field"><label>💧 ${T("mist")}</label><div class="seg" id="mist"><button data-k="misted_am" class="${f.misted_am ? "on" : ""}">아침</button><button data-k="misted_pm" class="${f.misted_pm ? "on" : ""}">저녁</button></div></div>
        <div class="field"><label>🌡️ 온도</label>${seg("temp_level", [["low", "낮음"], ["ok", "적정"], ["high", "높음"]], f.temp_level)}
          ${hasHygro ? `<div class="inline" style="margin-top:8px"><input type="number" id="temp_c" step="0.1" placeholder="온도 ℃" value="${f.temp_c}" /><span>℃</span></div>` : `<div class="hint">온습도계를 사면 숫자 입력 칸이 열려요</div>`}</div>
        <div class="field"><label>💦 습도</label>${seg("humidity_level", [["low", "낮음"], ["ok", "적정"], ["high", "높음"]], f.humidity_level)}
          ${hasHygro ? `<div class="inline" style="margin-top:8px"><input type="number" id="humidity_pct" placeholder="습도 %" value="${f.humidity_pct}" /><span>%</span></div>` : ""}</div>
      </div>
      <div class="card">
        <div class="field"><label>💩 ${T("poop")}</label>${seg("defecated", [["true", "있어요"], ["false", "없어요"]], f.defecated)}</div>
        <div class="field"><label>🧥 ${T("shed")}</label>${seg("shed_status", [["none", "없음"], ["shedding", Tshort("shedding")], ["done", Tshort("shed_done")]], f.shed_status)}</div>
        <div class="field"><label>⚖️ ${T("weight")} <span class="muted">(일주일에 한 번이면 충분)</span></label>
          <div class="inline"><input type="number" id="weight_g" step="0.1" placeholder="그램" value="${f.weight_g}" /><span>g</span></div>
          <label class="row" style="margin-top:8px;font-family:inherit;font-size:14px"><input type="checkbox" id="weight_est" ${f.weight_is_estimate ? "checked" : ""} style="width:22px;height:22px;min-height:0" /> 어림잡은 값이에요</label></div>
        <div class="field"><label>😊 오늘 모카 기분</label>${seg("mood", MOODS.map((m, i) => [i, m]), f.mood, "emoji")}</div>
      </div>
      <div class="card">
        <div class="field"><label>📸 사진 <span class="muted">(최대 3장)</span></label>
          <div class="photos" id="photos">${photos.map((p) => `<div class="ph"><img src="${p.url}" alt="" /><button data-del="${p.id}">✕</button></div>`).join("")}${photos.length < 3 ? `<button class="add" id="add-photo">＋</button>` : ""}</div>
          <input type="file" id="file" accept="image/*" hidden />
          ${!log.id ? `<div class="hint">사진은 먼저 저장한 뒤에 넣을 수 있어요</div>` : ""}</div>
        <div class="field"><label>📝 한 줄 일기</label><textarea id="note" maxlength="140" placeholder="오늘 모카는… (140자까지)">${esc(f.note)}</textarea></div>
      </div>
      <div class="sticky-save"><button class="btn primary block" id="save">저장하기</button></div>
      ${log.id ? `<p style="text-align:center;margin-top:14px"><button class="btn small ghost" id="del">이 날 기록 지우기</button></p>` : ""}`;

    view.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const seg = b.closest("[data-seg]");
      if (seg) {
        const name = seg.dataset.seg; const was = b.classList.contains("on");
        seg.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        if (!was) b.classList.add("on");
        const v = was ? null : b.dataset.v;
        f[name] = v === "true" ? true : v === "false" ? false : name === "mood" && v != null ? Number(v) : v;
        if (name === "fed") $("#feed-detail").hidden = f.fed !== true;
        return;
      }
      if (b.closest("#mist")) { b.classList.toggle("on"); f[b.dataset.k] = b.classList.contains("on"); return; }
      if (b.id === "add-photo") { $("#file").click(); return; }
      if (b.dataset.del) { await D.deletePhoto(b.dataset.del); toast("사진을 지웠어요"); renderLog(date); return; }
      if (b.id === "save") {
        const fields = { ...f };
        fields.temp_c = $("#temp_c") && $("#temp_c").value !== "" ? Number($("#temp_c").value) : null;
        fields.humidity_pct = $("#humidity_pct") && $("#humidity_pct").value !== "" ? Number($("#humidity_pct").value) : null;
        fields.weight_g = $("#weight_g").value !== "" ? Number($("#weight_g").value) : null;
        fields.weight_is_estimate = $("#weight_est").checked; fields.note = $("#note").value.trim();
        if (fields.fed !== true) { fields.food_type = null; fields.food_amount = null; fields.eaten = null; }
        b.disabled = true;
        try {
          await D.upsertLog(date, fields); await loadAll(); await evaluateBadges();
          toast("저장했어요 ✨");
          if ($("#modal").hidden) location.hash = "#today"; else { $("#modal").querySelector("button").onclick = () => { closeModal(); location.hash = "#today"; }; }
        } catch (err) { toast("저장 실패: " + err.message); b.disabled = false; }
        return;
      }
      if (b.id === "del") {
        modal(`<h3>이 날 기록을 지울까요?</h3><p class="muted">할 일 체크도 같이 지워져요.</p><div class="row" style="margin-top:14px"><button class="btn block" id="m-no">그만두기</button><button class="btn primary block" id="m-yes">지우기</button></div>`);
        $("#m-no").onclick = closeModal; $("#m-yes").onclick = async () => { await D.deleteLog(date); closeModal(); toast("지웠어요"); location.hash = "#calendar"; };
      }
    };
    $("#file").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      let l = logOf(date);
      if (!l) { toast("먼저 저장해 주세요"); return; }
      try { const blob = await resizeImage(file); await D.addPhoto(l.id, blob); await evaluateBadges(); toast("사진을 넣었어요"); renderLog(date); } catch (err) { toast("사진 실패: " + err.message); }
    };
  }

  // ---------- 달력 ----------
  let calMonth = null;
  async function renderCalendar() {
    await loadAll();
    const today = todayStr();
    if (!calMonth) calMonth = today.slice(0, 7);
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1); const days = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(`<div class="cal-cell empty"></div>`);
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${pad(m)}-${pad(d)}`; const future = ds > today; const lvl = future ? 0 : dayLevel(ds);
      cells.push(`<div class="cal-cell l${lvl} ${ds === today ? "today" : ""} ${future ? "future" : ""}" data-d="${ds}">${d}</div>`);
    }
    const monthLogs = state.logs.filter((l) => l.log_date.startsWith(calMonth)).length;
    view.innerHTML = `
      <div class="card">
        <div class="cal-head"><button class="btn small" id="prev">‹</button><h3>${y}년 ${m}월</h3><button class="btn small" id="next" ${calMonth >= today.slice(0, 7) ? "disabled" : ""}>›</button></div>
        <div class="cal-grid">${"일월화수목금토".split("").map((d) => `<div class="dow">${d}</div>`).join("")}${cells.join("")}</div>
        <div class="legend">적게 <i style="background:var(--grass-0)"></i><i style="background:var(--grass-1)"></i><i style="background:var(--grass-2)"></i><i style="background:var(--grass-3)"></i><i style="background:var(--grass-4)"></i> 많이</div>
        <p class="muted">이 달에 ${monthLogs}일 기록했어요 · 연속 ${streak()}일 🔥</p>
      </div>
      <div class="card" id="day-detail"><p class="muted">날짜를 누르면 그날 기록이 보여요</p></div>`;
    $("#prev").onclick = () => { calMonth = toStr(new Date(y, m - 2, 1)).slice(0, 7); renderCalendar(); };
    $("#next").onclick = () => { calMonth = toStr(new Date(y, m, 1)).slice(0, 7); renderCalendar(); };
    view.onclick = async (e) => {
      const c = e.target.closest(".cal-cell[data-d]"); if (!c || c.classList.contains("future")) return;
      const ds = c.dataset.d; const l = logOf(ds); const cs = checksOf(ds); const items = itemsFor(ds);
      const photos = l ? await D.getPhotos(l.id) : [];
      $("#day-detail").innerHTML = `<div class="row between"><h3>${fmtK(ds)}</h3><span class="chip">${dayCount(ds)}일째</span></div>
        <p class="muted">할 일 ${cs.filter((x) => x.done).length}/${items.length}${l ? ` · ${esc(memberName(l.member_id))}이(가) 기록` : ""}</p>
        ${l ? logSummary(l) : `<p class="muted">기록이 없는 날이에요</p>`}
        ${photos.length ? `<div class="album" style="margin-top:8px">${photos.map((p) => `<img src="${p.url}" alt="" />`).join("")}</div>` : ""}
        <a class="btn block" href="#log/${ds}" style="margin-top:10px">${l ? "고치기" : "이 날 기록하기"}</a>`;
    };
  }

  // ---------- 모카 ----------
  async function renderPet() {
    await loadAll();
    const pet = state.ctx.pet; const today = todayStr();
    const weights = state.logs.filter((l) => l.weight_g != null);
    const sheds = state.logs.filter((l) => l.shed_status && l.shed_status !== "none");
    const photos = await D.getAllPhotos();
    const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const have = new Set(state.badges.map((b) => b.badge_key));
    view.innerHTML = `
      <div class="card">
        <div class="hero"><div class="avatar">${photos.length ? `<img src="${photos[photos.length - 1].url}" alt="" />` : "🦎"}</div>
          <div><div class="big">${esc(pet.name)}</div><div class="muted">${esc(pet.species)} · ${esc(pet.morph)}</div><div class="muted">${pet.adopted_at} ${esc(pet.adopted_place || "")}에서 입양 · ${dayCount(today)}일째</div></div></div>
      </div>
      <div class="card"><h3>⚖️ ${T("weight")} 변화</h3>
        ${weights.length ? `<canvas id="wchart" height="180"></canvas><p class="hint">속이 빈 점은 어림잡은 값이에요</p>` : `<div class="empty"><div class="e">⚖️</div>아직 ${Tshort("weight")} 기록이 없어요.<br/>주방 저울로 한 번 재 볼까요?</div>`}
      </div>
      <div class="card"><h3>🍽️ 최근 2주 ${Tshort("feed")}</h3>
        <div class="dots">${last14.map((d) => { const l = logOf(d); const cls = l && l.fed === true ? "fed" : isFeedDay(d) && !(l && l.fed) ? "skip" : ""; return `<i class="${cls}" title="${d}"></i>`; }).join("")}</div>
        <p class="hint">초록: ${Tshort("feed")} 줌 · 분홍: ${Tshort("feed")} 날인데 기록 없음</p>
      </div>
      <div class="card"><h3>🧥 ${T("shed")} 기록</h3>
        ${sheds.length ? `<ul class="timeline">${sheds.slice().reverse().map((l) => `<li>${fmtK(l.log_date)} · ${l.shed_status === "shedding" ? Tshort("shedding") : Tshort("shed_done")}</li>`).join("")}</ul>` : `<p class="muted">아직 없어요. 어린 모카는 2~4주마다 허물을 벗어요.</p>`}
      </div>
      <div class="card"><h3>🏅 뱃지</h3>
        <div class="badges">${BADGES.map((b) => `<div class="badge ${have.has(b.key) ? "" : "locked"}"><div class="ico">${b.ico}</div><div class="name">${b.name}</div></div>`).join("")}</div>
      </div>
      <div class="card"><h3>📸 모카 앨범 <span class="muted">${photos.length}장</span></h3>
        ${photos.length ? `<div class="album">${photos.slice().reverse().map((p) => `<img src="${p.url}" alt="" />`).join("")}</div>` : `<p class="muted">기록할 때 사진을 넣으면 여기에 모여요</p>`}
      </div>`;
    if (weights.length && window.Chart) {
      new Chart($("#wchart"), { type: "line", data: { labels: weights.map((l) => l.log_date.slice(5).replace("-", "/")), datasets: [{ data: weights.map((l) => l.weight_g), borderColor: "#b48c3f", backgroundColor: "#d9b77a", tension: 0.3, pointRadius: 5,
        pointBackgroundColor: weights.map((l) => (l.weight_is_estimate ? "#fffaf2" : "#b48c3f")), pointBorderColor: "#b48c3f", pointBorderWidth: 2 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "g" } } } } });
    }
  }

  // ---------- 가족 ----------
  async function renderFamily() {
    const { family, me, members, pet } = state.ctx;
    const isAdmin = me.role === "admin";
    view.innerHTML = `
      <div class="card"><h3>🔑 초대 코드</h3><div class="code">${esc(family.invite_code)}</div><p class="hint">가족에게 이 코드를 알려 주면 같은 일지를 볼 수 있어요.</p></div>
      <div class="card"><h3>👨‍👩‍👧‍👦 ${esc(family.name)}</h3>
        ${members.map((m) => `<div class="member"><div class="av">${esc(m.nickname[0])}</div><div style="flex:1"><b>${esc(m.nickname)}</b> ${m.id === me.id ? '<span class="chip">나</span>' : ""}<div class="muted">${roleName(m.role)}</div></div>
          ${isAdmin && m.id !== me.id ? `<button class="btn small" data-role="${m.id}">역할</button><button class="btn small ghost" data-rm="${m.id}">내보내기</button>` : ""}
          ${D.mode === "demo" && m.id !== me.id ? `<button class="btn small" data-switch="${m.id}">이 사람으로</button>` : ""}</div>`).join("")}
      </div>
      <div class="card"><h3>⚙️ 설정</h3>
        <div class="field"><label>용어</label><div class="seg" id="terms"><button data-v="easy" class="${state.terms === "easy" ? "on" : ""}">쉬운 말(정식 용어)</button><button data-v="formal" class="${state.terms === "formal" ? "on" : ""}">정식 용어만</button></div></div>
        ${isAdmin ? `<div class="field"><label>${Tshort("feed")} 간격</label><div class="seg" id="feed-int">${[1, 2, 3].map((n) => `<button data-v="${n}" class="${pet.feed_interval_days === n ? "on" : ""}">${n === 1 ? "매일" : n + "일에 한 번"}</button>`).join("")}</div></div>
        <div class="field"><label>모카 나이 (개월, 어림)</label><div class="inline"><input type="number" id="age" value="${pet.age_months_estimate ?? ""}" placeholder="모르면 비워 두세요" /><button class="btn" id="age-save">저장</button></div></div>` : ""}
        <div class="field"><label>데이터</label><button class="btn block" id="export">전체 기록 내보내기 (JSON)</button></div>
        ${D.mode === "demo" ? `<div class="field"><label>데모 모드</label><p class="hint">지금은 이 폰에만 저장돼요. Supabase를 연결하면 가족과 공유돼요.</p><button class="btn small ghost" id="reset">데모 데이터 모두 지우기</button></div>` : ""}
      </div>`;
    view.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.closest("#terms")) { state.terms = b.dataset.v; localStorage.setItem("moca.terms", state.terms); renderFamily(); return; }
      if (b.closest("#feed-int")) { await D.updatePet({ feed_interval_days: Number(b.dataset.v) }); state.ctx = await D.getContext(); renderFamily(); toast("바꿨어요"); return; }
      if (b.id === "age-save") { const v = $("#age").value; await D.updatePet({ age_months_estimate: v === "" ? null : Number(v) }); state.ctx = await D.getContext(); toast("저장했어요"); return; }
      if (b.id === "export") { const data = await D.exportAll(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `moca-diary-${todayStr()}.json`; a.click(); return; }
      if (b.id === "reset") { if (confirm("정말 모두 지울까요?")) { await D.resetDemo(); location.hash = ""; boot(); } return; }
      if (b.dataset.switch) { await D.switchMember(b.dataset.switch); state.ctx = await D.getContext(); toast(`${state.ctx.me.nickname}(으)로 바꿨어요`); renderFamily(); return; }
      if (b.dataset.role) {
        const m = members.find((x) => x.id === b.dataset.role);
        modal(`<h3>${esc(m.nickname)} 역할</h3><div class="stack" style="margin-top:12px">${["child", "observer", "admin"].map((r) => `<button class="btn block ${m.role === r ? "primary" : ""}" data-set="${r}">${roleName(r)}</button>`).join("")}</div>`);
        $("#modal").onclick = async (e2) => { const s = e2.target.closest("[data-set]"); if (!s) { if (e2.target === $("#modal")) closeModal(); return; } await D.updateMember(m.id, { role: s.dataset.set }); state.ctx = await D.getContext(); closeModal(); renderFamily(); };
        return;
      }
      if (b.dataset.rm) { if (confirm("이 구성원을 내보낼까요?")) { await D.removeMember(b.dataset.rm); state.ctx = await D.getContext(); renderFamily(); } }
    };
  }

  // ---------- 시작 ----------
  async function boot() {
    try {
      const { joined } = await D.init();
      if (!joined) { renderJoin(); return; }
      state.ctx = await D.getContext();
      if (!state.ctx.me) { renderJoin(); return; }
      $("#tabbar").hidden = false;
      $("#pet-title").textContent = `${state.ctx.pet.name} 일지`;
      route();
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card"><h3>연결에 문제가 있어요</h3><p class="muted">${esc(e.message)}</p><p class="hint">config.js의 Supabase 설정과 네트워크를 확인해 주세요.</p></div>`;
    }
  }
  $("#btn-terms").onclick = () => { state.terms = state.terms === "easy" ? "formal" : "easy"; localStorage.setItem("moca.terms", state.terms); toast(state.terms === "easy" ? "쉬운 말(정식 용어)로 보여요" : "정식 용어로 보여요"); route(); };
  window.addEventListener("hashchange", route);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  boot();
})();
