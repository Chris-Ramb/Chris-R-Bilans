(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let currentStep = 1;
  let isDirty = false;

  const hhdMovements = ["DF", "PF", "INV", "EV"];
  const hipMovements = ["ABD hanche"];

  function markDirty() {
    isDirty = true;
  }

  function parseNum(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmtNum(n, digits = 1) {
    if (n === null || n === undefined || Number.isNaN(n)) return "";
    return Number(n).toFixed(digits);
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function checkedValues(selector) {
    return $$(selector).filter(el => el.checked).map(el => el.value);
  }

  function initDates() {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    if (!$("evalDate").value) $("evalDate").value = iso;
    computeJx();
  }

  function computeJx() {
    const trauma = $("traumaDate").value;
    const evalDate = $("evalDate").value;
    const out = $("jxDisplay");

    if (!trauma || !evalDate) {
      out.value = "";
      return;
    }

    const t = new Date(trauma + "T00:00:00");
    const e = new Date(evalDate + "T00:00:00");
    const diffMs = e - t;
    const days = Math.floor(diffMs / 86400000);

    if (!Number.isFinite(days)) {
      out.value = "";
    } else if (days >= 0) {
      out.value = `J${days}`;
    } else {
      out.value = `J${days} (date bilan < trauma)`;
    }
  }

  function goToStep(step) {
    currentStep = Math.max(1, Math.min(7, step));
    $$(".step-btn").forEach(btn => btn.classList.toggle("active", Number(btn.dataset.step) === currentStep));
    $$("[data-step-panel]").forEach(p => p.classList.toggle("active", Number(p.dataset.stepPanel) === currentStep));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindWizard() {
    $$(".step-btn").forEach(btn => btn.addEventListener("click", () => goToStep(Number(btn.dataset.step))));
    $$("[data-next]").forEach(btn => btn.addEventListener("click", () => goToStep(currentStep + 1)));
    $$("[data-prev]").forEach(btn => btn.addEventListener("click", () => goToStep(currentStep - 1)));
    $$("[data-step-jump]").forEach(btn => btn.addEventListener("click", () => goToStep(Number(btn.dataset.stepJump))));
  }

  function bindDirtyTracking() {
    document.addEventListener("input", (e) => {
      if (e.target && e.target.closest(".app")) {
        markDirty();
        liveRecalc(e.target);
      }
    });
    document.addEventListener("change", (e) => {
      if (e.target && e.target.closest(".app")) {
        markDirty();
        liveRecalc(e.target);
      }
    });

    window.addEventListener("beforeunload", (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  function liveRecalc(target) {
    const id = target.id;

    if (id === "traumaDate" || id === "evalDate") computeJx();
    if (id && id.startsWith("ott")) updateOttawa();
    if (id && id.startsWith("syn")) updateSyndesmose();

    if (["edemaLesion","edemaHealthy","thEdema"].includes(id)) updateEdema();
    if (["lungeCmLesion","lungeCmHealthy","thLungeCm","lungeDegLesion","lungeDegHealthy"].includes(id)) updateLunge();
    if (["balEO_L","balEO_S","balEC_L","balEC_S"].includes(id)) updateBalanceStatic();

    if (target.closest("#hhdTable") || target.closest("#hhdHipTable") || id === "hhdUnit" || id === "thLsi") {
      updateHhdUnitLabel();
      recalcAllHhd();
    }

    if (
      target.closest(".app") &&
      !target.closest("#printSummary")
    ) {
      refreshAutoSummary();
    }
  }

  function updateOttawa() {
    const yes = (id) => $(id).value === "Oui";
    const can4 = $("ott4steps").value;
    // Ottawa simplifié : douleur malléolaire + (sensibilité zones / incapacité 4 pas)
    const positive =
      (yes("ottPainMalleolar") && (yes("ottLatMall") || yes("ottMedMall") || can4 === "Non")) ||
      yes("ottM5") || yes("ottNav") || can4 === "Non";

    $("ottConclusionAuto").value = positive
      ? "Ottawa positif → imagerie / triage médical à considérer"
      : "Ottawa non concluant ou négatif (selon données saisies)";
  }

  function updateSyndesmose() {
    const pos = ["synPalp","synSqueeze","synER","synDfComp"].some(id => $(id).value === "Positif");
    $("synConclusionAuto").value = pos
      ? "Suspicion syndesmose (tests positifs) → prudence / avis médical"
      : "Pas d’argument fort de syndesmose (selon données saisies)";
  }

  function updateEdema() {
    const l = parseNum($("edemaLesion").value);
    const s = parseNum($("edemaHealthy").value);
    const thr = parseNum($("thEdema").value) ?? 1;
    if (l === null || s === null) {
      $("edemaDelta").value = "";
      $("edemaFlag").value = "";
      return;
    }
    const d = l - s;
    $("edemaDelta").value = fmtNum(d, 1);
    $("edemaFlag").value = Math.abs(d) >= thr ? "Delta notable" : "Delta faible";
  }

  function updateLunge() {
    const lcm = parseNum($("lungeCmLesion").value);
    const scm = parseNum($("lungeCmHealthy").value);
    const thr = parseNum($("thLungeCm").value) ?? 2;
    if (lcm !== null && scm !== null) {
      const d = lcm - scm;
      $("lungeCmDelta").value = fmtNum(d, 1);
      $("lungeCmFlag").value = Math.abs(d) >= thr ? "Asymétrie notable" : "Asymétrie faible";
    } else {
      $("lungeCmDelta").value = "";
      $("lungeCmFlag").value = "";
    }

    const ldeg = parseNum($("lungeDegLesion").value);
    const sdeg = parseNum($("lungeDegHealthy").value);
    if (ldeg !== null && sdeg !== null) {
      $("lungeDegDelta").value = fmtNum(ldeg - sdeg, 1);
    } else {
      $("lungeDegDelta").value = "";
    }
  }

  function updateBalanceStatic() {
    const eoL = parseNum($("balEO_L").value), eoS = parseNum($("balEO_S").value);
    const ecL = parseNum($("balEC_L").value), ecS = parseNum($("balEC_S").value);
    $("balEO_Delta").value = (eoL !== null && eoS !== null) ? fmtNum(eoL - eoS, 0) : "";
    $("balEC_Delta").value = (ecL !== null && ecS !== null) ? fmtNum(ecL - ecS, 0) : "";
  }

  function hhdRowHTML(name, prefix) {
    return `
      <tr data-hhd-row data-prefix="${prefix}" data-name="${name}">
        <td>${name}</td>
        <td>
          <select data-role="mode">
            <option>Make</option>
            <option>Break</option>
          </select>
        </td>
        <td class="tiny"><input type="checkbox" data-role="nr"></td>
        <td><input type="text" data-role="nrReason" placeholder="douleur / temps / matériel"></td>

        <td><input class="num" type="number" step="0.1" data-role="l1"></td>
        <td><input class="num" type="number" step="0.1" data-role="l2"></td>
        <td><input class="num" type="number" step="0.1" data-role="l3"></td>
        <td><input class="tiny" type="number" min="0" max="10" step="0.5" data-role="lpain"></td>

        <td><input class="num" type="number" step="0.1" data-role="s1"></td>
        <td><input class="num" type="number" step="0.1" data-role="s2"></td>
        <td><input class="num" type="number" step="0.1" data-role="s3"></td>
        <td><input class="tiny" type="number" min="0" max="10" step="0.5" data-role="spain"></td>

        <td class="calc" data-role="lbest"></td>
        <td class="calc" data-role="sbest"></td>
        <td class="calc" data-role="delta"></td>
        <td class="calc" data-role="lsi"></td>
      </tr>
    `;
  }

  function initHhdTables() {
    $("hhdRows").innerHTML = hhdMovements.map(m => hhdRowHTML(m, "ankle")).join("");
    $("hhdHipRows").innerHTML = hipMovements.map(m => hhdRowHTML(m, "hip")).join("");
    updateHhdUnitLabel();
    recalcAllHhd();
  }

  function bestOf(values) {
    const nums = values.map(parseNum).filter(v => v !== null);
    if (!nums.length) return null;
    return Math.max(...nums);
  }

  function recalcHhdTable(tableId) {
    const table = $(tableId);
    const lsiThr = parseNum($("thLsi").value) ?? 90;

    table.querySelectorAll("[data-hhd-row]").forEach(row => {
      const nr = row.querySelector('[data-role="nr"]').checked;

      const inputsToDisable = row.querySelectorAll('input:not([data-role="nr"]), select');
      inputsToDisable.forEach(el => {
        if (el.dataset.role === "mode") return;
        if (el.dataset.role === "nrReason") {
          el.disabled = !nr;
        } else if (el.dataset.role !== "nr") {
          if (["l1","l2","l3","lpain","s1","s2","s3","spain"].includes(el.dataset.role)) {
            el.disabled = nr;
          }
        }
      });

      const lbestCell = row.querySelector('[data-role="lbest"]');
      const sbestCell = row.querySelector('[data-role="sbest"]');
      const deltaCell = row.querySelector('[data-role="delta"]');
      const lsiCell = row.querySelector('[data-role="lsi"]');

      if (nr) {
        lbestCell.textContent = "NR";
        sbestCell.textContent = "NR";
        deltaCell.textContent = "—";
        lsiCell.textContent = "—";
        lsiCell.style.color = "";
        return;
      }

      const lbest = bestOf([
        row.querySelector('[data-role="l1"]').value,
        row.querySelector('[data-role="l2"]').value,
        row.querySelector('[data-role="l3"]').value
      ]);
      const sbest = bestOf([
        row.querySelector('[data-role="s1"]').value,
        row.querySelector('[data-role="s2"]').value,
        row.querySelector('[data-role="s3"]').value
      ]);

      lbestCell.textContent = lbest !== null ? fmtNum(lbest, 1) : "";
      sbestCell.textContent = sbest !== null ? fmtNum(sbest, 1) : "";

      if (lbest !== null && sbest !== null) {
        const delta = lbest - sbest;
        deltaCell.textContent = fmtNum(delta, 1);

        if (sbest !== 0) {
          const lsi = (lbest / sbest) * 100;
          lsiCell.textContent = fmtNum(lsi, 0);
          lsiCell.style.color = lsi < lsiThr ? "#d97706" : "#111827";
        } else {
          lsiCell.textContent = "NA";
          lsiCell.style.color = "";
        }
      } else {
        deltaCell.textContent = "";
        lsiCell.textContent = "";
        lsiCell.style.color = "";
      }
    });
  }

  function recalcAllHhd() {
    recalcHhdTable("hhdTable");
    recalcHhdTable("hhdHipTable");
  }

  function updateHhdUnitLabel() {
    const u = $("hhdUnit").value;
    $("hhdUnitLabel").textContent = `Unité actuelle : ${u}`;
  }

  function collectHhdRows(tableId) {
    const rows = [];
    $(tableId).querySelectorAll("[data-hhd-row]").forEach(row => {
      const get = (r) => row.querySelector(`[data-role="${r}"]`);
      rows.push({
        movement: row.dataset.name,
        mode: get("mode").value,
        nr: get("nr").checked,
        nrReason: get("nrReason").value,
        l1: get("l1").value, l2: get("l2").value, l3: get("l3").value,
        lpain: get("lpain").value,
        s1: get("s1").value, s2: get("s2").value, s3: get("s3").value,
        spain: get("spain").value,
        lbest: row.querySelector('[data-role="lbest"]').textContent,
        sbest: row.querySelector('[data-role="sbest"]').textContent,
        delta: row.querySelector('[data-role="delta"]').textContent,
        lsi: row.querySelector('[data-role="lsi"]').textContent
      });
    });
    return rows;
  }

  function levelTextToScore(v) {
    const map = { "Absent": 0, "Léger": 1, "Modéré": 2, "Sévère": 3 };
    return map[v] ?? null;
  }
  function getQfaamUrl() {
    const origin = window.location.origin;
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    // ex: /Chris-R-Bilans/roast-cheville/
    const repo = pathParts[0] || "Chris-R-Bilans";
    const base = `${origin}/${repo}/q-faam-f/`;

    const p = new URLSearchParams();
    const code = safeText($("patientCode")?.value);
    const age = safeText($("patientAge")?.value);
    const side = safeText($("sideLesion")?.value);
    const jx = safeText($("jxDisplay")?.value);
    const date = safeText($("evalDate")?.value);

    if (code) p.set("code", code);
    if (age) p.set("age", age);
    if (side) p.set("side", side);
    if (jx) p.set("jx", jx);
    if (date) p.set("date", date);

    return `${base}${p.toString() ? "?" + p.toString() : ""}`;
  }

  function updateQfaamQr() {
    const link = $("qfaamLink");
    const img = $("qfaamQrImg");
    if (!link || !img) return;

    const url = getQfaamUrl();
    link.href = url;

    // Génération du QR via service web (simple/rapide)
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  }

  function parseQfaamPasteAndFill() {
    const input = $("faamPaste");
    if (!input) return;
    const txt = safeText(input.value);
    if (!txt) return;

    const get = (label) => {
      const re = new RegExp(`${label}:([^|]+)`, "i");
      const m = txt.match(re);
      return m ? m[1].trim() : "";
    };

    const rawR = get("Droite");
    const pctR = get("DroitePct");
    const rawL = get("Gauche");
    const pctL = get("GauchePct");

    if (rawR && $("faamRawR")) $("faamRawR").value = rawR;
    if (pctR && $("faamPctR")) $("faamPctR").value = pctR;
    if (rawL && $("faamRawL")) $("faamRawL").value = rawL;
    if (pctL && $("faamPctL")) $("faamPctL").value = pctL;

    refreshAutoSummary();
  }

  function bindQfaam() {
    const watchedIds = ["patientCode", "patientAge", "sideLesion", "evalDate", "traumaDate"];
    watchedIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", updateQfaamQr);
      el.addEventListener("change", () => {
        computeJx();
        updateQfaamQr();
      });
    });

    if ($("btnRefreshQfaamQr")) {
      $("btnRefreshQfaamQr").addEventListener("click", updateQfaamQr);
    }

    if ($("faamPaste")) {
      $("faamPaste").addEventListener("change", parseQfaamPasteAndFill);
      $("faamPaste").addEventListener("blur", parseQfaamPasteAndFill);
    }
  }
  function refreshAutoSummary() {
    const thPain = parseNum($("thPain")?.value) ?? 5; // thPain may not exist if removed, safe fallback
    const lsiThr = parseNum($("thLsi").value) ?? 90;
    const edemaThr = parseNum($("thEdema").value) ?? 1;
    const lungeThr = parseNum($("thLungeCm").value) ?? 2;

    const messages = [];

    // Triage
    const ottAuto = safeText($("ottConclusionAuto").value);
    const synAuto = safeText($("synConclusionAuto").value);
    if (ottAuto.includes("positif")) messages.push(`- Triage fracture: ${ottAuto}.`);
    if (synAuto.toLowerCase().includes("suspicion")) messages.push(`- Triage syndesmose: ${synAuto}.`);

    // Pain
    const painFields = ["repos","appui","marche","course","saut","actuelle"];
    const painValues = painFields.map(k => parseNum(document.querySelector(`.pain[data-pain="${k}"]`)?.value)).filter(v => v !== null);
    const painMax = painValues.length ? Math.max(...painValues) : null;
    const painCurrent = parseNum(document.querySelector('.pain[data-pain="actuelle"]')?.value);
    if (painMax !== null) {
      if (painMax >= thPain) messages.push(`- Douleur élevée (EVA max ${fmtNum(painMax,0)}/10) : prudence sur la charge.`);
      else messages.push(`- Douleur compatible avec progression graduée (EVA max ${fmtNum(painMax,0)}/10).`);
    }

    // Edema
    const edemaDelta = parseNum($("edemaDelta").value);
    if (edemaDelta !== null) {
      if (Math.abs(edemaDelta) >= edemaThr) messages.push(`- Œdème: delta figure-of-eight ${fmtNum(edemaDelta,1)} cm (notable).`);
      else messages.push(`- Œdème: delta figure-of-eight ${fmtNum(edemaDelta,1)} cm (faible).`);
    }

    // Lunge
    const lungeDelta = parseNum($("lungeCmDelta").value);
    if (lungeDelta !== null) {
      if (Math.abs(lungeDelta) >= lungeThr) messages.push(`- ROM DF en charge: asymétrie lunge ${fmtNum(lungeDelta,1)} cm.`);
      else messages.push(`- ROM DF en charge: asymétrie lunge faible (${fmtNum(lungeDelta,1)} cm).`);
    }

    // HHD deficits
    const ankleRows = collectHhdRows("hhdTable");
    const deficits = ankleRows
      .filter(r => !r.nr && r.lsi && r.lsi !== "NA")
      .map(r => ({ m: r.movement, lsi: Number(r.lsi) }))
      .filter(r => Number.isFinite(r.lsi) && r.lsi < lsiThr);

    if (deficits.length) {
      const txt = deficits.map(d => `${d.m} ${Math.round(d.lsi)}%`).join(", ");
      messages.push(`- Force HHD: déficits < ${lsiThr}% sur ${txt}.`);
    } else if (ankleRows.some(r => !r.nr && r.lsi)) {
      messages.push(`- Force HHD: pas de déficit majeur identifié selon seuil LSI < ${lsiThr}%.`);
    }

    // Balance
    const eoDelta = parseNum($("balEO_Delta").value);
    const ecDelta = parseNum($("balEC_Delta").value);
    if (eoDelta !== null || ecDelta !== null) {
      let balMsg = "- Équilibre statique:";
      const parts = [];
      if (eoDelta !== null) parts.push(`EO delta erreurs ${fmtNum(eoDelta,0)}`);
      if (ecDelta !== null) parts.push(`EC delta erreurs ${fmtNum(ecDelta,0)}`);
      balMsg += " " + parts.join(" ; ") + ".";
      messages.push(balMsg);
    }

    // Gait / run
    const gaitLimp = $("gaitLimp").value;
    if (gaitLimp) messages.push(`- Marche: boiterie ${gaitLimp.toLowerCase()}.`);
    const runDone = $("runDone").value;
    const runPain = parseNum($("runPain").value);
    if (runDone === "Réalisée") {
      messages.push(`- Course légère réalisée${runPain !== null ? ` (douleur EVA ${fmtNum(runPain,0)}/10)` : ""}.`);
    }

    // Activity
    const goal = safeText($("actGoal").value);
    if (goal) messages.push(`- Objectif: ${goal}.`);

    // Free triage text appended if present
    const triageFree = safeText($("triageFreeConclusion").value);
    if (triageFree) messages.push(`- Note triage: ${triageFree}`);
    const faamR = safeText($("faamPctR")?.value);
    const faamL = safeText($("faamPctL")?.value);
    if (faamR || faamL) {
      messages.push(`- Q-FAAM-F: ${faamR ? `Droite ${faamR}%` : ""}${faamR && faamL ? " ; " : ""}${faamL ? `Gauche ${faamL}%` : ""}.`);
    }
    if (!messages.length) {
      $("autoSummary").value = "Aucune donnée suffisante pour générer une synthèse automatique.";
      return;
    }

    const header = `Synthèse auto — ${new Date().toLocaleString("fr-FR")}\n`;
    $("autoSummary").value = header + messages.join("\n");
  }

  function collectData() {
    return {
      mode: document.querySelector('input[name="appMode"]:checked')?.value || "",
      unit: $("hhdUnit").value,
      patientCode: $("patientCode").value,
      patientAge: $("patientAge").value,
      sideLesion: $("sideLesion").value,
      sideDominant: $("sideDominant").value,
      traumaDate: $("traumaDate").value,
      evalDate: $("evalDate").value,
      jx: $("jxDisplay").value,
      consultTypes: checkedValues(".consultType"),
      mech: checkedValues(".mech"),
      mechOther: $("mechOther").value,

      hxSprain: $("hxSprain").value,
      hxCount: $("hxCount").value,
      hxSide: $("hxSide").value,
      hxInstab: $("hxInstab").value,

      triage: {
        ottPainMalleolar: $("ottPainMalleolar").value,
        ottLatMall: $("ottLatMall").value,
        ottMedMall: $("ottMedMall").value,
        ottM5: $("ottM5").value,
        ottNav: $("ottNav").value,
        ott4steps: $("ott4steps").value,
        ottLimp: $("ottLimp").value,
        ottConclusionAuto: $("ottConclusionAuto").value,
        synPalp: $("synPalp").value,
        synSqueeze: $("synSqueeze").value,
        synER: $("synER").value,
        synDfComp: $("synDfComp").value,
        synPain: $("synPain").value,
        synLocation: $("synLocation").value,
        synConclusionAuto: $("synConclusionAuto").value,
        triageFreeConclusion: $("triageFreeConclusion").value,
      },

      pain: {
        repos: document.querySelector('.pain[data-pain="repos"]')?.value || "",
        appui: document.querySelector('.pain[data-pain="appui"]')?.value || "",
        marche: document.querySelector('.pain[data-pain="marche"]')?.value || "",
        course: document.querySelector('.pain[data-pain="course"]')?.value || "",
        saut: document.querySelector('.pain[data-pain="saut"]')?.value || "",
        actuelle: document.querySelector('.pain[data-pain="actuelle"]')?.value || "",
        locations: checkedValues(".painLoc"),
        locationFree: $("painLocFree").value,
      },

      edema: {
        lesion: $("edemaLesion").value,
        healthy: $("edemaHealthy").value,
        delta: $("edemaDelta").value,
        flag: $("edemaFlag").value
      },

      lunge: {
        cmL: $("lungeCmLesion").value, cmS: $("lungeCmHealthy").value,
        cmDelta: $("lungeCmDelta").value, cmFlag: $("lungeCmFlag").value,
        degL: $("lungeDegLesion").value, degS: $("lungeDegHealthy").value,
        degDelta: $("lungeDegDelta").value,
        note: $("lungeNote").value
      },

      glide: {
        lesionQual: $("glideLesionQual").value,
        healthyQual: $("glideHealthyQual").value,
        lesionPain: $("glideLesionPain").value,
        healthyPain: $("glideHealthyPain").value,
        measureText: $("glideMeasureText").value,
        comment: $("glideComment").value
      },

      hhdAnkle: collectHhdRows("hhdTable"),
      hhdHip: collectHhdRows("hhdHipTable"),

      balance: {
        eoL: $("balEO_L").value, eoS: $("balEO_S").value, eoDelta: $("balEO_Delta").value, eoComment: $("balEO_Comment").value,
        ecL: $("balEC_L").value, ecS: $("balEC_S").value, ecDelta: $("balEC_Delta").value, ecComment: $("balEC_Comment").value,
      },

      dyn: {
        type: $("dynType").value,
        limbLen: $("dynLimbLen").value,
        composite: $("dynComposite").value,
        asym: $("dynAsymText").value,
        comment: $("dynQualComment").value
      },

      gait: {
        limp: $("gaitLimp").value,
        stance: $("gaitStance").value,
        dfavoid: $("gaitDFavoid").value,
        er: $("gaitER").value,
        shortStep: $("gaitShortStep").value,
        other: $("gaitOther").value
      },

      run: {
        done: $("runDone").value,
        pain: $("runPain").value,
        quality: $("runQuality").value,
        comment: $("runComment").value
      },

      activity: {
        sport: $("actSport").value,
        level: $("actLevel").value,
        volume: $("actVolume").value,
        role: $("actRole").value,
        returnDate: $("actReturnDate").value,
        tegner: $("actTegner").value,
        goal: $("actGoal").value
      },

          faam: {
        rawR: $("faamRawR")?.value || "",
        pctR: $("faamPctR")?.value || "",
        rawL: $("faamRawL")?.value || "",
        pctL: $("faamPctL")?.value || "",
        paste: $("faamPaste")?.value || "",
        comment: $("faamComment")?.value || "",
        source: $("faamSource")?.value || ""
      },

      autoSummary: $("autoSummary").value
    };
  }

  function rowKV(label, value) {
    return `<tr><th style="width:35%">${label}</th><td>${value || ""}</td></tr>`;
  }

  function hhdRowsToHTML(rows, unit) {
    const visible = rows.filter(r => r.nr || r.lbest || r.sbest || r.l1 || r.s1);
    if (!visible.length) return "<div>Aucune donnée HHD saisie.</div>";

    const trs = visible.map(r => `
      <tr>
        <td>${r.movement}</td>
        <td>${r.mode}</td>
        <td>${r.nr ? "NR" : ""}</td>
        <td>${r.nrReason || ""}</td>
        <td>${r.lbest || ""}</td>
        <td>${r.sbest || ""}</td>
        <td>${r.delta || ""}</td>
        <td>${r.lsi || ""}</td>
        <td>${r.lpain || ""}</td>
        <td>${r.spain || ""}</td>
      </tr>
    `).join("");

    return `
      <table>
        <thead>
          <tr>
            <th>Mouvement</th><th>Test</th><th>NR</th><th>Motif</th>
            <th>Retenu L (${unit})</th><th>Retenu S (${unit})</th><th>Delta</th><th>LSI %</th><th>Douleur L</th><th>Douleur S</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
    `;
  }

  function buildPrintSummary() {
    const d = collectData();

    const headerLine = [
      d.patientCode ? `Code: ${d.patientCode}` : "",
      d.patientAge ? `Âge: ${d.patientAge}` : "",
      d.sideLesion ? `Lésé: ${d.sideLesion}` : "",
      d.sideDominant ? `Dominant: ${d.sideDominant}` : "",
      d.jx ? d.jx : ""
    ].filter(Boolean).join(" • ");

    const consult = d.consultTypes.join(", ");
    const mech = [...d.mech, d.mechOther].filter(Boolean).join(", ");
    const painLocs = [...d.pain.locations, d.pain.locationFree].filter(Boolean).join(", ");

    const html = `
      <h1>ROAST Cheville — Bilan initial & suivi</h1>
      <div style="font-size:12px;margin-bottom:8px;">
        ${headerLine || "Sans identification"}<br>
        Mode: ${d.mode || ""} • Bilan: ${d.evalDate || ""} • Trauma: ${d.traumaDate || ""}<br>
        Consult: ${consult || ""}<br>
        Mécanisme: ${mech || ""}
      </div>

      <div class="ps-card">
        <h2>Triage</h2>
        <table>
          <tbody>
            ${rowKV("Ottawa auto", d.triage.ottConclusionAuto)}
            ${rowKV("Syndesmose auto", d.triage.synConclusionAuto)}
            ${rowKV("Conclusion triage (libre)", d.triage.triageFreeConclusion)}
          </tbody>
        </table>
      </div>

      <div class="ps-card">
        <h2>Douleur / œdème / ROM / Arthro</h2>
        <table>
          <tbody>
            ${rowKV("Douleur repos / appui / marche", [d.pain.repos,d.pain.appui,d.pain.marche].filter(Boolean).join(" / "))}
            ${rowKV("Douleur course / saut / actuelle", [d.pain.course,d.pain.saut,d.pain.actuelle].filter(Boolean).join(" / "))}
            ${rowKV("Localisation douleur", painLocs)}
            ${rowKV("Figure-of-eight L / S / Delta (cm)", [d.edema.lesion,d.edema.healthy,d.edema.delta].filter(v=>v!=="").join(" / "))}
            ${rowKV("Lunge cm L / S / Delta", [d.lunge.cmL,d.lunge.cmS,d.lunge.cmDelta].filter(v=>v!=="").join(" / "))}
            ${rowKV("Lunge ° L / S / Delta", [d.lunge.degL,d.lunge.degS,d.lunge.degDelta].filter(v=>v!=="").join(" / "))}
            ${rowKV("Glide postérieur", [d.glide.measureText,d.glide.comment].filter(Boolean).join(" | "))}
            ${rowKV("Glide quali L / S + EVA", `${d.glide.lesionQual || ""} (${d.glide.lesionPain || ""}) / ${d.glide.healthyQual || ""} (${d.glide.healthyPain || ""})`)}
          </tbody>
        </table>
      </div>

      <div class="ps-card">
        <h2>Force HHD cheville (${d.unit})</h2>
        ${hhdRowsToHTML(d.hhdAnkle, d.unit)}
      </div>

      <div class="ps-card">
        <h2>Bloc proximal HHD (${d.unit})</h2>
        ${hhdRowsToHTML(d.hhdHip, d.unit)}
      </div>

      <div class="ps-card">
        <h2>Équilibre</h2>
        <table>
          <tbody>
            ${rowKV("Statique EO (erreurs L / S / Delta)", [d.balance.eoL,d.balance.eoS,d.balance.eoDelta].filter(v=>v!=="").join(" / "))}
            ${rowKV("Statique EC (erreurs L / S / Delta)", [d.balance.ecL,d.balance.ecS,d.balance.ecDelta].filter(v=>v!=="").join(" / "))}
            ${rowKV("Commentaires EO/EC", [d.balance.eoComment,d.balance.ecComment].filter(Boolean).join(" | "))}
            ${rowKV("Dynamique", [d.dyn.type,d.dyn.composite && `Composite ${d.dyn.composite}`,d.dyn.asym].filter(Boolean).join(" | "))}
            ${rowKV("Qualité dynamique", d.dyn.comment)}
          </tbody>
        </table>
      </div>

      <div class="ps-card">
        <h2>Marche / course / activité / PROM</h2>
        <table>
          <tbody>
            ${rowKV("Marche", [d.gait.limp && `Boiterie ${d.gait.limp}`, d.gait.stance && `Appui ${d.gait.stance}`, d.gait.dfavoid && `DF ${d.gait.dfavoid}`, d.gait.er && `RE ${d.gait.er}`, d.gait.shortStep && `Pas ${d.gait.shortStep}`, d.gait.other].filter(Boolean).join(" | "))}
            ${rowKV("Course légère", [d.run.done, d.run.pain && `EVA ${d.run.pain}`, d.run.quality, d.run.comment].filter(Boolean).join(" | "))}
            ${rowKV("Activité", [d.activity.sport, d.activity.level, d.activity.volume, d.activity.role].filter(Boolean).join(" | "))}
            ${rowKV("Échéance / Tegner / Objectif", [d.activity.returnDate, d.activity.tegner && `Tegner ${d.activity.tegner}`, d.activity.goal].filter(Boolean).join(" | "))}
                        ${rowKV("Quick FAAM", [
              d.faam.rawR && `Droite ${d.faam.rawR}`,
              d.faam.pctR && `Droite % ${d.faam.pctR}`,
              d.faam.rawL && `Gauche ${d.faam.rawL}`,
              d.faam.pctL && `Gauche % ${d.faam.pctL}`,
              d.faam.source,
              d.faam.comment
            ].filter(Boolean).join(" | "))}
          </tbody>
        </table>
      </div>

      <div class="ps-card">
        <h2>Synthèse automatique</h2>
        <div style="white-space:pre-wrap;font-size:12px">${(d.autoSummary || "").replace(/</g,"&lt;")}</div>
      </div>
    `;

    $("printSummary").innerHTML = html;
  }

  function exportPdf() {
    refreshAutoSummary();
    buildPrintSummary();
    document.body.classList.add("print-summary");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-summary");
    }, 300);
    isDirty = false; // on considère l’export comme “sauvegarde” locale (PDF)
  }

  function printForm() {
    window.print();
  }

  function resetAll(askConfirm = true) {
    if (askConfirm && !confirm("Effacer toutes les données du bilan en cours ?")) return;

    // reset form-like inputs
    $$("input, select, textarea").forEach(el => {
      if (el.type === "radio" || el.type === "checkbox") {
        el.checked = false;
      } else if (!el.readOnly) {
        el.value = "";
      }
    });

    // restore defaults
    const modeRadio = document.querySelector('input[name="appMode"][value="ROAST cabinet"]');
    if (modeRadio) modeRadio.checked = true;
    $("hhdUnit").value = "kgf";
    $("thLsi").value = 90;
    $("thEdema").value = 1;
    $("thLungeCm").value = 2;

    // clear readonly computed
    ["ottConclusionAuto","synConclusionAuto","edemaDelta","edemaFlag","lungeCmDelta","lungeCmFlag","lungeDegDelta","balEO_Delta","balEC_Delta","jxDisplay"].forEach(id => {
      if ($(id)) $(id).value = "";
    });

    // recreate HHD rows (easier than clearing every field)
    initHhdTables();

    // reset dates
    initDates();

    // recalc
    updateOttawa();
    updateSyndesmose();
    updateEdema();
    updateLunge();
    updateBalanceStatic();
    refreshAutoSummary();

    // return to start
    goToStep(1);

    isDirty = false;
  }

  function bindTopButtons() {
    $("btnExportPdf").addEventListener("click", exportPdf);
    $("btnPrintForm").addEventListener("click", printForm);
    $("btnNew").addEventListener("click", () => resetAll(true));
    $("btnClear").addEventListener("click", () => resetAll(true));
    $("btnRefreshSummary").addEventListener("click", refreshAutoSummary);
  }

  function bindSpecifics() {
    // Defaults
    updateHhdUnitLabel();

    // Events that need immediate compute at startup
    ["traumaDate","evalDate"].forEach(id => $(id).addEventListener("change", computeJx));

    // Triage auto updates
    ["ottPainMalleolar","ottLatMall","ottMedMall","ottM5","ottNav","ott4steps","ottLimp"].forEach(id => {
      $(id).addEventListener("change", updateOttawa);
    });
    ["synPalp","synSqueeze","synER","synDfComp","synPain","synLocation"].forEach(id => {
      $(id).addEventListener("change", updateSyndesmose);
      $(id).addEventListener("input", updateSyndesmose);
    });

    // Recalc HHD via delegation
    $("hhdTable").addEventListener("input", () => { recalcAllHhd(); refreshAutoSummary(); });
    $("hhdTable").addEventListener("change", () => { recalcAllHhd(); refreshAutoSummary(); });
    $("hhdHipTable").addEventListener("input", () => { recalcAllHhd(); refreshAutoSummary(); });
    $("hhdHipTable").addEventListener("change", () => { recalcAllHhd(); refreshAutoSummary(); });

    $("hhdUnit").addEventListener("change", updateHhdUnitLabel);

    // Print mode cleanup
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-summary");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // silencieux
      });
    }
  }

  function boot() {
    bindWizard();
    bindDirtyTracking();
    bindTopButtons();
    initHhdTables();
    bindSpecifics();
    initDates();
    updateOttawa();
    updateSyndesmose();
    updateEdema();
    updateLunge();
    updateBalanceStatic();
    refreshAutoSummary();
    bindQfaam();
    updateQfaamQr();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
