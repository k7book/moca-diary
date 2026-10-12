// 데이터 계층: Supabase 모드와 데모(로컬) 모드가 같은 API를 제공한다.
// 모든 함수는 Promise를 돌려준다.
(function () {
  const cfg = window.MOCA_CONFIG || {};
  const hasSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
  const nowIso = () => new Date().toISOString();

  // ============================================================
  // 데모 모드 (localStorage)
  // ============================================================
  const LS_KEY = "moca.demo.v1";
  function loadDemo() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { return null; }
  }
  function saveDemo(db) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) { console.warn("save failed", e); }
  }
  function emptyDb() {
    return { family: null, members: [], me: null, pet: null, logs: [], checklist: [], supplies: [], photos: [], badges: [] };
  }

  const demo = {
    mode: "demo",
    db: loadDemo() || emptyDb(),
    persist() { saveDemo(this.db); },

    async init() {
      return { mode: "demo", joined: !!this.db.me };
    },
    async createFamily({ familyName, nickname, pet }) {
      const code = Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
      const family = { id: uuid(), name: familyName, invite_code: code, created_at: nowIso() };
      const me = { id: uuid(), family_id: family.id, nickname, role: "admin", created_at: nowIso() };
      const p = { id: uuid(), family_id: family.id, name: pet.name || "모카", species: pet.species || "크레스티드 게코",
        morph: pet.morph || "릴리 화이트", adopted_at: pet.adopted_at, adopted_place: pet.adopted_place || "",
        age_months_estimate: pet.age_months_estimate || null, feed_interval_days: pet.feed_interval_days || 2 };
      this.db.family = family; this.db.members = [me]; this.db.me = me; this.db.pet = p;
      this.persist();
      return { invite_code: code };
    },
    async joinFamily({ code, nickname, role }) {
      // 데모 모드에서는 같은 폰 안에서만 합류 가능: 가족이 이미 있으면 그 가족에 구성원 추가
      if (!this.db.family) throw new Error("데모 모드에서는 먼저 이 폰에서 가족을 만들어야 해요.");
      if (this.db.family.invite_code !== code.trim().toUpperCase()) throw new Error("초대 코드가 맞지 않아요.");
      const me = { id: uuid(), family_id: this.db.family.id, nickname, role: role === "child" ? "child" : "observer", created_at: nowIso() };
      this.db.members.push(me); this.db.me = me; this.persist();
      return {};
    },
    async switchMember(memberId) { // 데모 전용: 가족 구성원 전환
      const m = this.db.members.find((x) => x.id === memberId);
      if (m) { this.db.me = m; this.persist(); }
    },
    async getContext() {
      return { family: this.db.family, me: this.db.me, pet: this.db.pet, members: this.db.members };
    },
    async updatePet(fields) { Object.assign(this.db.pet, fields); this.persist(); return this.db.pet; },
    async updateMember(id, fields) { const m = this.db.members.find((x) => x.id === id); if (m) Object.assign(m, fields); if (this.db.me.id === id) Object.assign(this.db.me, fields); this.persist(); },
    async removeMember(id) { this.db.members = this.db.members.filter((x) => x.id !== id); this.persist(); },

    async getLog(date) { return this.db.logs.find((l) => l.log_date === date) || null; },
    async getLogs() { return this.db.logs.slice().sort((a, b) => a.log_date < b.log_date ? -1 : 1); },
    async upsertLog(date, fields) {
      let l = this.db.logs.find((x) => x.log_date === date);
      if (!l) { l = { id: uuid(), pet_id: this.db.pet.id, member_id: this.db.me.id, log_date: date, created_at: nowIso() }; this.db.logs.push(l); }
      Object.assign(l, fields, { updated_at: nowIso() });
      this.persist(); return l;
    },
    async deleteLog(date) { this.db.logs = this.db.logs.filter((x) => x.log_date !== date); this.db.checklist = this.db.checklist.filter((x) => x.log_date !== date); this.persist(); },

    async getChecklist(date) { return this.db.checklist.filter((c) => c.log_date === date); },
    async getChecklistAll() { return this.db.checklist.slice(); },
    async setChecklist(date, key, done) {
      let c = this.db.checklist.find((x) => x.log_date === date && x.item_key === key);
      if (!c) { c = { id: uuid(), pet_id: this.db.pet.id, log_date: date, item_key: key }; this.db.checklist.push(c); }
      c.done = done; c.done_by = done ? this.db.me.id : null; c.done_at = done ? nowIso() : null;
      this.persist(); return c;
    },

    async getSupplies() { return this.db.supplies.slice(); },
    async setSupply(key, done) {
      let s = this.db.supplies.find((x) => x.item_key === key);
      if (!s) { s = { id: uuid(), pet_id: this.db.pet.id, item_key: key }; this.db.supplies.push(s); }
      s.done = done; s.done_at = done ? nowIso() : null; this.persist(); return s;
    },

    async getBadges() { return this.db.badges.slice(); },
    async awardBadge(key) {
      if (this.db.badges.some((b) => b.badge_key === key && b.member_id === this.db.me.id)) return null;
      const b = { id: uuid(), member_id: this.db.me.id, badge_key: key, earned_at: nowIso() };
      this.db.badges.push(b); this.persist(); return b;
    },

    async getPhotos(logId) { return this.db.photos.filter((p) => p.log_id === logId).map((p) => ({ ...p, url: p.data_url })); },
    async getAllPhotos() { return this.db.photos.map((p) => ({ ...p, url: p.data_url })); },
    async addPhoto(logId, blob) {
      const dataUrl = await blobToDataUrl(blob);
      const p = { id: uuid(), log_id: logId, data_url: dataUrl, created_at: nowIso() };
      this.db.photos.push(p); this.persist(); return { ...p, url: dataUrl };
    },
    async deletePhoto(id) { this.db.photos = this.db.photos.filter((p) => p.id !== id); this.persist(); },

    async exportAll() { return JSON.parse(JSON.stringify(this.db)); },
    async resetDemo() { this.db = emptyDb(); this.persist(); },
  };

  function blobToDataUrl(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  }

  // ============================================================
  // Supabase 모드
  // ============================================================
  const sb = {
    mode: "supabase",
    client: null,
    ctx: null,

    async init() {
      this.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      let { data: { session } } = await this.client.auth.getSession();
      if (!session) {
        const { data, error } = await this.client.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      const { data: me } = await this.client.from("members").select("*").eq("user_id", session.user.id).maybeSingle();
      return { mode: "supabase", joined: !!me };
    },
    async createFamily({ familyName, nickname, pet }) {
      const { data, error } = await this.client.rpc("create_family", { p_family_name: familyName, p_nickname: nickname, p_pet: pet });
      if (error) throw error;
      this.ctx = null; return data;
    },
    async joinFamily({ code, nickname, role }) {
      const { data, error } = await this.client.rpc("join_family", { p_code: code, p_nickname: nickname, p_role: role });
      if (error) throw new Error(error.message.includes("invalid code") ? "초대 코드가 맞지 않아요." : error.message);
      this.ctx = null; return data;
    },
    async getContext() {
      if (this.ctx) return this.ctx;
      const { data: { user } } = await this.client.auth.getUser();
      const { data: me } = await this.client.from("members").select("*").eq("user_id", user.id).maybeSingle();
      if (!me) return { family: null, me: null, pet: null, members: [] };
      const [{ data: family }, { data: pets }, { data: members }] = await Promise.all([
        this.client.from("families").select("*").eq("id", me.family_id).single(),
        this.client.from("pets").select("*").eq("family_id", me.family_id).order("created_at"),
        this.client.from("members").select("*").eq("family_id", me.family_id).order("created_at"),
      ]);
      this.ctx = { family, me, pet: pets && pets[0], members: members || [] };
      return this.ctx;
    },
    async updatePet(fields) {
      const { data, error } = await this.client.from("pets").update(fields).eq("id", this.ctx.pet.id).select().single();
      if (error) throw error; this.ctx.pet = data; return data;
    },
    async updateMember(id, fields) {
      const { error } = await this.client.from("members").update(fields).eq("id", id); if (error) throw error; this.ctx = null;
    },
    async removeMember(id) { const { error } = await this.client.from("members").delete().eq("id", id); if (error) throw error; this.ctx = null; },

    async getLog(date) {
      const { data } = await this.client.from("daily_logs").select("*").eq("pet_id", this.ctx.pet.id).eq("log_date", date).maybeSingle();
      return data || null;
    },
    async getLogs() {
      const { data } = await this.client.from("daily_logs").select("*").eq("pet_id", this.ctx.pet.id).order("log_date");
      return data || [];
    },
    async upsertLog(date, fields) {
      const existing = await this.getLog(date);
      const row = { ...fields, pet_id: this.ctx.pet.id, log_date: date };
      if (!existing) row.member_id = this.ctx.me.id;
      const { data, error } = await this.client.from("daily_logs").upsert(row, { onConflict: "pet_id,log_date" }).select().single();
      if (error) throw error; return data;
    },
    async deleteLog(date) {
      await this.client.from("daily_logs").delete().eq("pet_id", this.ctx.pet.id).eq("log_date", date);
      await this.client.from("checklist_items").delete().eq("pet_id", this.ctx.pet.id).eq("log_date", date);
    },
    async getChecklist(date) {
      const { data } = await this.client.from("checklist_items").select("*").eq("pet_id", this.ctx.pet.id).eq("log_date", date);
      return data || [];
    },
    async getChecklistAll() {
      const { data } = await this.client.from("checklist_items").select("*").eq("pet_id", this.ctx.pet.id);
      return data || [];
    },
    async setChecklist(date, key, done) {
      const row = { pet_id: this.ctx.pet.id, log_date: date, item_key: key, done, done_by: done ? this.ctx.me.id : null, done_at: done ? nowIso() : null };
      const { data, error } = await this.client.from("checklist_items").upsert(row, { onConflict: "pet_id,log_date,item_key" }).select().single();
      if (error) throw error; return data;
    },
    async getSupplies() {
      const { data } = await this.client.from("supplies").select("*").eq("pet_id", this.ctx.pet.id); return data || [];
    },
    async setSupply(key, done) {
      const row = { pet_id: this.ctx.pet.id, item_key: key, done, done_at: done ? nowIso() : null };
      const { data, error } = await this.client.from("supplies").upsert(row, { onConflict: "pet_id,item_key" }).select().single();
      if (error) throw error; return data;
    },
    async getBadges() {
      const ids = this.ctx.members.map((m) => m.id);
      const { data } = await this.client.from("badges").select("*").in("member_id", ids); return data || [];
    },
    async awardBadge(key) {
      const { data, error } = await this.client.from("badges").insert({ member_id: this.ctx.me.id, badge_key: key }).select().single();
      if (error) return null; // 이미 있음
      return data;
    },
    async getPhotos(logId) {
      const { data } = await this.client.from("photos").select("*").eq("log_id", logId).order("created_at");
      return this._sign(data || []);
    },
    async getAllPhotos() {
      const { data } = await this.client.from("photos").select("*, daily_logs!inner(pet_id, log_date)").eq("daily_logs.pet_id", this.ctx.pet.id).order("created_at");
      return this._sign(data || []);
    },
    async _sign(rows) {
      if (!rows.length) return [];
      const { data } = await this.client.storage.from("photos").createSignedUrls(rows.map((r) => r.storage_path), 3600);
      return rows.map((r, i) => ({ ...r, url: data && data[i] ? data[i].signedUrl : "" }));
    },
    async addPhoto(logId, blob) {
      const path = `${this.ctx.family.id}/${logId}/${Date.now()}.jpg`;
      const { error: upErr } = await this.client.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data, error } = await this.client.from("photos").insert({ log_id: logId, storage_path: path }).select().single();
      if (error) throw error;
      const [signed] = await this._sign([data]); return signed;
    },
    async deletePhoto(id) {
      const { data: p } = await this.client.from("photos").select("*").eq("id", id).single();
      if (p) { await this.client.storage.from("photos").remove([p.storage_path]); await this.client.from("photos").delete().eq("id", id); }
    },
    async exportAll() {
      const [logs, checklist, supplies, badges] = await Promise.all([this.getLogs(), this.getChecklistAll(), this.getSupplies(), this.getBadges()]);
      return { family: this.ctx.family, pet: this.ctx.pet, members: this.ctx.members, logs, checklist, supplies, badges };
    },
    async switchMember() {},
    async resetDemo() {},
  };

  window.MocaData = hasSupabase ? sb : demo;
})();
