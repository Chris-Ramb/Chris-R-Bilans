(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let currentStep = 1;
  let isDirty = false;

  const forceDefs = [
    { key: "inv", label: "Inverseurs" },
    { key: "ev", label: "Éverseurs" },
    { key: "df", label: "Flexion dorsale" },
    { key: "toeFlex", label: "Fléchisseurs des orteils" },
    { key: "halluxFlex", label: "Fléchisseur du GO" }
  ];

  function markDirty() { isDirty = true; }

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

  function bestOf(values) {
    const nums = values.map(parseNum).filter(v => v !== null);
    if (!nums.length) return null;
    return Math.max(...nums);
  }

  function getLesionSide() {
    return $("sideLesion")?.value || "";
  }

  function getSideLabels() {
    const lesion = getLesionSide();
    let right = "Droite";
    let left = "Gauche";
    if (lesion === "Droite") right = "Droite (lésé)";
    if (lesion === "Gauche") left = "Gauche (lésé)";
    if (lesion === "Bilatéral") {
      right = "Droite (lésé)";
      left = "Gauche (lésé)";
    }
    return { right, left, lesion };
  }

  function getLesionHealthyValues(rightVal, leftVal) {
    const lesion = getLesionSide();
    if (lesion === "Droite") return { lesionVal: rightVal, healthyVal: leftVal, unilateral: true };
    if (lesion === "Gauche") return { lesionVal: leftVal, healthyVal: rightVal, unilateral: true };
    return { lesionVal: null, healthyVal: null, unilateral: false };
  }

  function initDates() {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    if ($("evalDate") && !$("evalDate").value) $("evalDate").value = iso;
    computeJx();
  }

  function computeJx() {
    const trauma = $("traumaDate")?.value;
    const evalDate = $("evalDate")?.value;
    const out = $("jxDisplay");
    if (!out) return;

    if (!trauma || !evalDate) {
      out.value = "";
      return;
    }

    const t = new Date(trauma + "T00:00:00");
    const e = new Date(evalDate + "T00:00:00");
    const diffMs = e - t;
    const days = Math.floor(diffMs / 86400000);

    if (!Number.isFinite(days)) out.value = "";
    else if (days >= 0) out.value = `J${days}`;
    else out.value = `J${days} (date bilan < trauma)`;
  }

  function goToStep(step) {
    currentStep = Math.max(1, Math.min(8, step));
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

    if (["edemaLesion", "edemaHealthy", "thEdema"].includes(id)) updateEdema();
    if (["lungeCmLesion", "lungeCmHealthy", "thLungeCm", "lungeDegLesion", "lungeDegHealthy"].includes(id)) updateLunge();
    if (["balEO_L", "balEO_S", "balEC_L", "balEC_S"].includes(id)) updateBalanceStatic();

    if (
      target.closest('[data-force-table]') ||
      target.closest("#forceContainer") ||
      ["hhdUnit","thLsi","sideLesion","calfStdRight","calfStdLeft","calfModRight","calfModLeft"].includes(id)
    ) {
      updateForceUnitLabel();
      updateForceLabels();
      recalcAllForceTables();
      recalcCalfRaisePair("std");
      recalcCalfRaisePair("mod");
    }

    if (target.closest(".app") && !target.closest("#printSummary")) {
      refreshAutoSummary();
    }
  }

  function updateOttawa() {
    const yes = (id) => $(id)?.value === "Oui";
    const can4 = $("ott4steps")?.value;
    const positive =
      (yes("ottPainMalleolar") && (yes("ottLatMall") || yes("ottMedMall") || can4 === "Non")) ||
      yes("ottM5") || yes("ottNav") || can4 === "Non";

    if ($("ottConclusionAuto")) {
      $("ottConclusionAuto").value = positive
        ? "Ottawa positif → imagerie / triage médical à considérer"
        : "Ottawa non concluant ou négatif (selon données saisies)";
    }
  }

  function updateSyndesmose() {
    const ids = ["synPalp", "synSqueeze", "synER", "synDfComp"];
    const pos = ids.some(id => $(id)?.value === "Positif");
    if ($("synConclusionAuto")) {
      $("synConclusionAuto").value = pos
        ? "Suspicion syndesmose (tests positifs) → prudence / avis médical"
        : "Pas d’argument fort de syndesmose (selon données saisies)";
    }
  }

  function updateEdema() {
    const l = parseNum($("edemaLesion")?.value);
    const s = parseNum($("edemaHealthy")?.value);
    const thr = parseNum($("thEdema")?.value) ?? 1;

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
    const lcm = parseNum($("lungeCmLesion")?.value);
    const scm = parseNum($("lungeCmHealthy")?.value);
    const thr = parseNum($("thLungeCm")?.value) ?? 2;

    if (lcm !== null && scm !== null) {
      const d = lcm - scm;
      $("lungeCmDelta").value = fmtNum(d, 1);
      $("lungeCmFlag").value = Math.abs(d) >= thr ? "Asymétrie notable" : "Asymétrie faible";
    } else {
      $("lungeCmDelta").value = "";
      $("lungeCmFlag").value = "";
    }

    const ldeg = parseNum($("lungeDegLesion")?.value);
    const sdeg = parseNum($("lungeDegHealthy")?.value);
    $("lungeDegDelta").value = (ldeg !== null && sdeg !== null) ? fmtNum(ldeg - sdeg, 1) : "";
  }

  function updateBalanceStatic() {
    const eoL = parseNum($("balEO_L")?.value), eoS = parseNum($("balEO_S")?.value);
    const ecL = parseNum($("balEC_L")?.value), ecS = parseNum($("balEC_S")?.value);
    $("balEO_Delta").value = (eoL !== null && eoS !== null) ? fmtNum(eoL - eoS, 0) : "";
    $("balEC_Delta").value = (ecL !== null && ecS !== null) ? fmtNum(ecL - ecS, 0) : "";
  }

  // ===== FORCE UI =====
  function forceTableHTML(def) {
    return `
      <div class="card" data-force-block="${def.key}">
        <h3>${def.label}</h3>
        <div class="table-wrap">
          <table data-force-table="${def.key}" data-force-label="${def.label}">
            <thead>
              <tr>
                <th>Make/Break</th>
                <th>NR</th>
                <th>Motif NR</th>
                <th><span data-force-side="right"></span> E1</th>
                <th><span data-force-side="right"></span> E2</th>
                <th><span data-force-side="right"></span> E3</th>
                <th>Douleur <span data-force-side-short="right"></span></th>
                <th><span data-force-side="left"></span> E1</th>
                <th><span data-force-side="left"></span> E2</th>
                <th><span data-force-side="left"></span> E3</th>
                <th>Douleur <span data-force-side-short="left"></span></th>
                <th>Retenu <span data-force-side-short="right"></span></th>
                <th>Retenu <span data-force-side-short="left"></span></th>
                <th data-force-delta-head>Delta</th>
                <th data-force-lsi-head>LSI %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <select data-role="mode">
                    <option>Make</option>
                    <option>Break</option>
                  </select>
                </td>
                <td><input type="checkbox" data-role="nr"></td>
                <td><input type="text" data-role="nrReason" placeholder="douleur / temps / matériel"></td>

                <td><input class="num" type="number" step="0.1" data-role="r1"></td>
                <td><input class="num" type="number" step="0.1" data-role="r2"></td>
                <td><input class="num" type="number" step="0.1" data-role="r3"></td>
                <td><input class="tiny" type="number" min="0" max="10" step="0.5" data-role="rpain"></td>

                <td><input class="num" type="number" step="0.1" data-role="l1"></td>
                <td><input class="num" type="number" step="0.1" data-role="l2"></td>
                <td><input class="num" type="number" step="0.1" data-role="l3"></td>
                <td><input class="tiny" type="number" min="0" max="10" step="0.5" data-role="lpain"></td>

                <td class="calc" data-role="rbest"></td>
                <td class="calc" data-role="lbest"></td>
                <td class="calc" data-role="delta"></td>
                <td class="calc" data-role="lsi"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="field" style="margin-top:8px">
          <label>Commentaire</label>
          <textarea id="forceComment_${def.key}" data-force-comment-for="${def.key}"></textarea>
        </div>
      </div>
    `;
  }

  function tricepsBlockHTML() {
    return `
      <div class="card" data-force-block="triceps">
        <h3>Triceps sural</h3>

        <div style="font-weight:600; margin:4px 0 8px;">1) Single calf raise</div>
        <div class="grid g4">
          <div class="field">
            <label><span data-force-side="right"></span> (nb)</label>
            <input id="calfStdRight" type="number" min="0" step="1">
          </div>
          <div class="field">
            <label><span data-force-side="left"></span> (nb)</label>
            <input id="calfStdLeft" type="number" min="0" step="1">
          </div>
          <div class="field">
            <label id="calfStdDeltaLabel">Delta</label>
            <input id="calfStdDelta" type="text" readonly>
          </div>
          <div class="field">
            <label id="calfStdLsiLabel">LSI %</label>
            <input id="calfStdLsi" type="text" readonly>
          </div>
        </div>
        <div class="field" style="margin-top:8px">
          <label>Commentaire single calf raise</label>
          <textarea id="calfStdComment"></textarea>
        </div>

        <div style="font-weight:600; margin:12px 0 8px;">2) Single calf raise modifié</div>
        <div class="grid g4">
          <div class="field">
            <label><span data-force-side="right"></span> (nb)</label>
            <input id="calfModRight" type="number" min="0" step="1">
          </div>
          <div class="field">
            <label><span data-force-side="left"></span> (nb)</label>
            <input id="calfModLeft" type="number" min="0" step="1">
          </div>
          <div class="field">
            <label id="calfModDeltaLabel">Delta</label>
            <input id="calfModDelta" type="text" readonly>
          </div>
          <div class="field">
            <label id="calfModLsiLabel">LSI %</label>
            <input id="calfModLsi" type="text" readonly>
          </div>
        </div>
        <div class="field" style="margin-top:8px">
          <label>Commentaire single calf raise modifié</label>
          <textarea id="calfModComment"></textarea>
        </div>

        <div style="font-weight:600; margin:14px 0 8px;">3) Soléaire</div>
        <div class="table-wrap">
          <table data-force-table="soleus" data-force-label="Soléaire">
            <thead>
              <tr>
                <th>Make/Break</th>
                <th>NR</th>
                <th>Motif NR</th>
                <th><span data-force-side="right"></span> E1</th>
                <th><span data-force-side="right"></span> E2</th>
                <th><span data-force-side="right"></span> E3</th>
                <th>Douleur <span data-force-side-short="right"></span></th>
                <th><span data-force-side="left"></span> E1</th>
                <th><span data-force-side="left"></span> E2</th>
                <th><span data-force-side="left"></span> E3</th>
                <th>Douleur <span data-force-side-short="left"></span></th>
                <th>Retenu <span data-force-side-short="right"></span></th>
                <th>Retenu <span data-force-side-short="left"></span></th>
                <th data-force-delta-head>Delta</th>
                <th data-force-lsi-head>LSI %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <select data-role="mode">
                    <option>Make</option>
                    <option>Break</option>
                  </select>
                </td>
                <td><input type="checkbox" data-role="nr"></td>
                <td><input type="text" data-role="nrReason" placeholder="douleur / temps / matériel"></td>

                <td><input class="num" type="number" step="0.1" data-role="r1"></td>
                <td><input class="num" type="number" step="0.1" data-role="r2"></td>
                <td><input class="num" type="number" step="0.1" data-role="r3"></td>
                <td><input class="tiny" type="number" min="0" max="10" step="0.5" data-role="rpain"></td>

                <td><input class="num" type="number" step="0.1" data-role="l1"></td>
                <td><input class="num" type="number" step="0.1" data-role="l2"></td>
                <td><input class="num" type="number" step="0.1" data-role="l3"></td>
                <td><input class="tiny" type="number" min="0" max="10" step="0.5" data-role="lpain"></td>

                <td class="calc" data-role="rbest"></td>
                <td class="calc" data-role="lbest"></td>
                <td class="calc" data-role="delta"></td>
                <td class="calc" data-role="lsi"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="field" style="margin-top:8px">
          <label>Commentaire soléaire</label>
          <textarea id="forceComment_soleus" data-force-comment-for="soleus"></textarea>
        </div>
      </div>
    `;
  }

  function initForceSection() {
    const container = $("forceContainer");
    if (!container) return;

    const unit = $("hhdUnit")?.value || "kgf";

    const intro = `
      <div class="card">
        <h3>Paramètres de force</h3>
        <div class="help" id="forceUnitLabel">Unité actuelle : ${unit}</div>
        <div class="help" id="forceSideInfo">Le calcul du LSI utilise le côté lésé défini en étape 2.</div>
      </div>
    `;

    container.innerHTML = intro + forceDefs.map(forceTableHTML).join("") + tricepsBlockHTML();

    updateForceLabels();
    recalcAllForceTables();
    recalcCalfRaisePair("std");
    recalcCalfRaisePair("mod");
  }

  function updateForceUnitLabel() {
    const unit = $("hhdUnit")?.value || "kgf";
    if ($("forceUnitLabel")) $("forceUnitLabel").textContent = `Unité actuelle : ${unit}`;
  }

  function updateForceLabels() {
    const labels = getSideLabels();

    $$('[data-force-side="right"]').forEach(el => { el.textContent = labels.right; });
    $$('[data-force-side="left"]').forEach(el => { el.textContent = labels.left; });

    $$('[data-force-side-short="right"]').forEach(el => {
      el.textContent = labels.right.includes("(lésé)") ? "D*" : "D";
    });
    $$('[data-force-side-short="left"]').forEach(el => {
      el.textContent = labels.left.includes("(lésé)") ? "G*" : "G";
    });

    const deltaHead = (labels.lesion === "Droite" || labels.lesion === "Gauche")
      ? "Delta (lésé - sain)"
      : "Delta (Droite - Gauche)";

    const lsiHead = (labels.lesion === "Droite" || labels.lesion === "Gauche")
      ? "LSI % (lésé/sain)"
      : (labels.lesion === "Bilatéral" ? "LSI % (NA bilatéral)" : "LSI %");

    $$("[data-force-delta-head]").forEach(el => { el.textContent = deltaHead; });
    $$("[data-force-lsi-head]").forEach(el => { el.textContent = lsiHead; });

    if ($("calfStdDeltaLabel")) $("calfStdDeltaLabel").textContent = deltaHead;
    if ($("calfModDeltaLabel")) $("calfModDeltaLabel").textContent = deltaHead;
    if ($("calfStdLsiLabel")) $("calfStdLsiLabel").textContent = lsiHead;
    if ($("calfModLsiLabel")) $("calfModLsiLabel").textContent = lsiHead;

    if ($("forceSideInfo")) {
      if (!labels.lesion) $("forceSideInfo").textContent = "Sélectionne un côté lésé en étape 2 pour activer le LSI.";
      else if (labels.lesion === "Bilatéral") $("forceSideInfo").textContent = "Côté lésé = bilatéral : LSI non calculé (delta D-G uniquement).";
      else $("forceSideInfo").textContent = "Le calcul du LSI utilise le côté lésé défini en étape 2.";
    }
  }

  function recalcForceTable(table) {
    if (!table) return;
    const lsiThr = parseNum($("thLsi")?.value) ?? 90;
    const row = table.querySelector("tbody tr");
    if (!row) return;

    const get = (role) => row.querySelector(`[data-role="${role}"]`);
    const nr = get("nr").checked;

    ["r1","r2","r3","rpain","l1","l2","l3","lpain"].forEach(role => {
      get(role).disabled = nr;
    });
    get("nrReason").disabled = !nr;

    if (nr) {
      get("rbest").textContent = "NR";
      get("lbest").textContent = "NR";
      get("delta").textContent = "—";
      get("lsi").textContent = "—";
      get("lsi").style.color = "";
      return;
    }

    const rbest = bestOf([get("r1").value, get("r2").value, get("r3").value]);
    const lbest = bestOf([get("l1").value, get("l2").value, get("l3").value]);

    get("rbest").textContent = rbest !== null ? fmtNum(rbest, 1) : "";
    get("lbest").textContent = lbest !== null ? fmtNum(lbest, 1) : "";

    if (rbest !== null && lbest !== null) {
      const lesion = getLesionSide();
      const { lesionVal, healthyVal, unilateral } = getLesionHealthyValues(rbest, lbest);

      if (unilateral) {
        get("delta").textContent = fmtNum(lesionVal - healthyVal, 1);
        if (healthyVal && healthyVal !== 0) {
          const lsi = (lesionVal / healthyVal) * 100;
          get("lsi").textContent = fmtNum(lsi, 0);
          get("lsi").style.color = lsi < lsiThr ? "#d97706" : "#111827";
        } else {
          get("lsi").textContent = "NA";
          get("lsi").style.color = "";
        }
      } else {
        get("delta").textContent = fmtNum(rbest - lbest, 1);
        get("lsi").textContent = lesion === "Bilatéral" ? "NA" : "";
        get("lsi").style.color = "";
      }
    } else {
      get("delta").textContent = "";
      get("lsi").textContent = "";
      get("lsi").style.color = "";
    }
  }

  function recalcAllForceTables() {
    $$("[data-force-table]").forEach(recalcForceTable);
  }

  function recalcCalfRaisePair(kind) {
    const isStd = kind === "std";
    const rightId = isStd ? "calfStdRight" : "calfModRight";
    const leftId = isStd ? "calfStdLeft" : "calfModLeft";
    const deltaId = isStd ? "calfStdDelta" : "calfModDelta";
    const lsiId = isStd ? "calfStdLsi" : "calfModLsi";

    const r = parseNum($(rightId)?.value);
    const l = parseNum($(leftId)?.value);

    if (r === null || l === null) {
      $(deltaId).value = "";
      $(lsiId).value = "";
      return;
    }

    const lesion = getLesionSide();
    const { lesionVal, healthyVal, unilateral } = getLesionHealthyValues(r, l);

    if (unilateral) {
      $(deltaId).value = fmtNum(lesionVal - healthyVal, 0);
      if (healthyVal && healthyVal !== 0) {
        $(lsiId).value = fmtNum((lesionVal / healthyVal) * 100, 0);
      } else {
        $(lsiId).value = "NA";
      }
    } else {
      $(deltaId).value = fmtNum(r - l, 0);
      $(lsiId).value = lesion === "Bilatéral" ? "NA" : "";
    }
  }

  function collectForceRows() {
    return $$("[data-force-table]").map(table => {
      const row = table.querySelector("tbody tr");
      const get = (role) => row.querySelector(`[data-role="${role}"]`);
      const key = table.dataset.forceTable;
      const comment = $(`forceComment_${key}`)?.value || "";

      return {
        key,
        test: table.dataset.forceLabel || "",
        mode: get("mode").value,
        nr: get("nr").checked,
        nrReason: get("nrReason").value,
        r1: get("r1").value, r2: get("r2").value, r3: get("r3").value,
        rpain: get("rpain").value,
        l1: get("l1").value, l2: get("l2").value, l3: get("l3").value,
        lpain: get("lpain").value,
        rbest: get("rbest").textContent,
        lbest: get("lbest").textContent,
        delta: get("delta").textContent,
        lsi: get("lsi").textContent,
        comment
      };
    });
  }

  // ===== Quick FAAM =====
  function getQfaamUrl() {
    const origin = window.location.origin;
    const pathParts = window.location.pathname.split("/").filter(Boolean);
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
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  }

  function parseQfaamPasteAndFill() {
    const txt = safeText($("faamPaste")?.value);
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

    if (rawR) $("faamRawR").value = rawR;
    if (pctR) $("faamPctR").value = pctR;
    if (rawL) $("faamRawL").value = rawL;
    if (pctL) $("faamPctL").value = pctL;

    refreshAutoSummary();
  }

  function bindQfaam() {
    ["patientCode","patientAge","sideLesion","evalDate","traumaDate"].forEach(id => {
      $(id)?.addEventListener("input", updateQfaamQr);
      $(id)?.addEventListener("change", () => { computeJx(); updateQfaamQr(); });
    });

    $("btnRefreshQfaamQr")?.addEventListener("click", updateQfaamQr);
    $("faamPaste")?.addEventListener("change", parseQfaamPasteAndFill);
    $("faamPaste")?.addEventListener("blur", parseQfaamPasteAndFill);
  }

  // ===== Synthèse auto =====
  function refreshAutoSummary() {
    const lsiThr = parseNum($("thLsi")?.value) ?? 90;
    const edemaThr = parseNum($("thEdema")?.value) ?? 1;
    const lungeThr = parseNum($("thLungeCm")?.value) ?? 2;

    const messages = [];

    const ottAuto = safeText($("ottConclusionAuto")?.value);
    const synAuto = safeText($("synConclusionAuto")?.value);
    if (ottAuto.includes("positif")) messages.push(`- Triage fracture: ${ottAuto}.`);
    if (synAuto.toLowerCase().includes("suspicion")) messages.push(`- Triage syndesmose: ${synAuto}.`);

    const painKeys = ["repos","appui","marche","course","saut","actuelle"];
    const painValues = painKeys
      .map(k => parseNum(document.querySelector(`.pain[data-pain="${k}"]`)?.value))
      .filter(v => v !== null);
    const painMax = painValues.length ? Math.max(...painValues) : null;
    if (painMax !== null) {
      messages.push(
        painMax >= 5
          ? `- Douleur élevée (EVA max ${fmtNum(painMax,0)}/10) : prudence sur la charge.`
          : `- Douleur compatible avec progression graduée (EVA max ${fmtNum(painMax,0)}/10).`
      );
    }

    const edemaDelta = parseNum($("edemaDelta")?.value);
    if (edemaDelta !== null) {
      messages.push(
        Math.abs(edemaDelta) >= edemaThr
          ? `- Œdème: delta figure-of-eight ${fmtNum(edemaDelta,1)} cm (notable).`
          : `- Œdème: delta figure-of-eight ${fmtNum(edemaDelta,1)} cm (faible).`
      );
    }

    const lungeDelta = parseNum($("lungeCmDelta")?.value);
    if (lungeDelta !== null) {
      messages.push(
        Math.abs(lungeDelta) >= lungeThr
          ? `- ROM DF en charge: asymétrie lunge ${fmtNum(lungeDelta,1)} cm.`
          : `- ROM DF en charge: asymétrie lunge faible (${fmtNum(lungeDelta,1)} cm).`
      );
    }

    const forceRows = collectForceRows();
    const deficits = forceRows
      .filter(r => !r.nr && r.lsi && !["NA","—",""].includes(r.lsi))
      .map(r => ({ test: r.test, lsi: Number(r.lsi) }))
      .filter(r => Number.isFinite(r.lsi) && r.lsi < lsiThr);

    if (deficits.length) {
      messages.push(`- Force: déficits < ${lsiThr}% sur ${deficits.map(d => `${d.test} ${Math.round(d.lsi)}%`).join(", ")}.`);
    } else if (forceRows.some(r => !r.nr && (r.rbest || r.lbest))) {
      messages.push(`- Force: pas de déficit majeur identifié selon seuil LSI < ${lsiThr}% (si côté lésé renseigné).`);
    }

    const calfParts = [];
    const stdDelta = safeText($("calfStdDelta")?.value), stdLsi = safeText($("calfStdLsi")?.value);
    const modDelta = safeText($("calfModDelta")?.value), modLsi = safeText($("calfModLsi")?.value);
    if (stdDelta || stdLsi) calfParts.push(`single calf raise Δ ${stdDelta || "?"}${stdLsi ? ` / LSI ${stdLsi}%` : ""}`);
    if (modDelta || modLsi) calfParts.push(`single calf raise modifié Δ ${modDelta || "?"}${modLsi ? ` / LSI ${modLsi}%` : ""}`);
    if (calfParts.length) messages.push(`- Triceps sural: ${calfParts.join(" ; ")}.`);

    const eoDelta = parseNum($("balEO_Delta")?.value);
    const ecDelta = parseNum($("balEC_Delta")?.value);
    if (eoDelta !== null || ecDelta !== null) {
      const parts = [];
      if (eoDelta !== null) parts.push(`EO delta erreurs ${fmtNum(eoDelta,0)}`);
      if (ecDelta !== null) parts.push(`EC delta erreurs ${fmtNum(ecDelta,0)}`);
      messages.push(`- Équilibre statique: ${parts.join(" ; ")}.`);
    }

    const gaitLimp = $("gaitLimp")?.value;
    if (gaitLimp) messages.push(`- Marche: boiterie ${gaitLimp.toLowerCase()}.`);

    const runDone = $("runDone")?.value;
    const runPain = parseNum($("runPain")?.value);
    if (runDone === "Réalisée") {
      messages.push(`- Course légère réalisée${runPain !== null ? ` (douleur EVA ${fmtNum(runPain,0)}/10)` : ""}.`);
    }

    const goal = safeText($("actGoal")?.value);
    if (goal) messages.push(`- Objectif: ${goal}.`);

    const triageFree = safeText($("triageFreeConclusion")?.value);
    if (triageFree) messages.push(`- Note triage: ${triageFree}`);

    const faamR = safeText($("faamPctR")?.value);
    const faamL = safeText($("faamPctL")?.value);
    if (faamR || faamL) {
      messages.push(`- Q-FAAM-F: ${faamR ? `Droite ${faamR}%` : ""}${faamR && faamL ? " ; " : ""}${faamL ? `Gauche ${faamL}%` : ""}.`);
    }

    $("autoSummary").value = messages.length
      ? `Synthèse auto — ${new Date().toLocaleString("fr-FR")}\n` + messages.join("\n")
      : "Aucune donnée suffisante pour générer une synthèse automatique.";
  }

  // ===== Collecte =====
  function collectData() {
    return {
      mode: document.querySelector('input[name="appMode"]:checked')?.value || "",
      unit: $("hhdUnit")?.value || "kgf",
      patientCode: $("patientCode")?.value || "",
      patientAge: $("patientAge")?.value || "",
      sideLesion: $("sideLesion")?.value || "",
      sideDominant: $("sideDominant")?.value || "",
      traumaDate: $("traumaDate")?.value || "",
      evalDate: $("evalDate")?.value || "",
      jx: $("jxDisplay")?.value || "",
      consultTypes: checkedValues(".consultType"),
      mech: checkedValues(".mech"),
      mechOther: $("mechOther")?.value || "",

      hxSprain: $("hxSprain")?.value || "",
      hxFree: $("hxFree")?.value || "",
      hxCount: $("hxCount")?.value || "",
      hxSide: $("hxSide")?.value || "",
      hxInstab: $("hxInstab")?.value || "",

      triage: {
        ottConclusionAuto: $("ottConclusionAuto")?.value || "",
        synConclusionAuto: $("synConclusionAuto")?.value || "",
        triageFreeConclusion: $("triageFreeConclusion")?.value || "",
      },

      pain: {
        repos: document.querySelector('.pain[data-pain="repos"]')?.value || "",
        appui: document.querySelector('.pain[data-pain="appui"]')?.value || "",
        marche: document.querySelector('.pain[data-pain="marche"]')?.value || "",
        course: document.querySelector('.pain[data-pain="course"]')?.value || "",
        saut: document.querySelector('.pain[data-pain="saut"]')?.value || "",
        actuelle: document.querySelector('.pain[data-pain="actuelle"]')?.value || "",
        locationFree: $("painLocFree")?.value || "",
      },

      edema: {
        lesion: $("edemaLesion")?.value || "",
        healthy: $("edemaHealthy")?.value || "",
        delta: $("edemaDelta")?.value || "",
      },

      lunge: {
        cmL: $("lungeCmLesion")?.value || "",
        cmS: $("lungeCmHealthy")?.value || "",
        cmDelta: $("lungeCmDelta")?.value || "",
        degL: $("lungeDegLesion")?.value || "",
        degS: $("lungeDegHealthy")?.value || "",
        degDelta: $("lungeDegDelta")?.value || "",
        note: $("lungeNote")?.value || ""
      },

      glide: {
        lesionQual: $("glideLesionQual")?.value || "",
        healthyQual: $("glideHealthyQual")?.value || "",
        lesionPain: $("glideLesionPain")?.value || "",
        healthyPain: $("glideHealthyPain")?.value || "",
        measureText: $("glideMeasureText")?.value || "",
        comment: $("glideComment")?.value || ""
      },

      force: {
        sideLesion: $("sideLesion")?.value || "",
        rows: collectForceRows(),
        calfStd: {
          right: $("calfStdRight")?.value || "",
          left: $("calfStdLeft")?.value || "",
          delta: $("calfStdDelta")?.value || "",
          lsi: $("calfStdLsi")?.value || "",
          comment: $("calfStdComment")?.value || ""
        },
        calfMod: {
          right: $("calfModRight")?.value || "",
          left: $("calfModLeft")?.value || "",
          delta: $("calfModDelta")?.value || "",
          lsi: $("calfModLsi")?.value || "",
          comment: $("calfModComment")?.value || ""
        }
      },

      balance: {
        eoL: $("balEO_L")?.value || "", eoS: $("balEO_S")?.value || "", eoDelta: $("balEO_Delta")?.value || "", eoComment: $("balEO_Comment")?.value || "",
        ecL: $("balEC_L")?.value || "", ecS: $("balEC_S")?.value || "", ecDelta: $("balEC_Delta")?.value || "", ecComment: $("balEC_Comment")?.value || "",
      },

      dyn: {
        type: $("dynType")?.value || "",
        composite: $("dynComposite")?.value || "",
        asym: $("dynAsymText")?.value || "",
        comment: $("dynQualComment")?.value || ""
      },

      gait: {
        limp: $("gaitLimp")?.value || "",
        stance: $("gaitStance")?.value || "",
        dfavoid: $("gaitDFavoid")?.value || "",
        er: $("gaitER")?.value || "",
        shortStep: $("gaitShortStep")?.value || "",
        other: $("gaitOther")?.value || ""
      },

      run: {
        done: $("runDone")?.value || "",
        pain: $("runPain")?.value || "",
        quality: $("runQuality")?.value || "",
        comment: $("runComment")?.value || ""
      },

      activity: {
        sport: $("actSport")?.value || "",
        level: $("actLevel")?.value || "",
        volume: $("actVolume")?.value || "",
        role: $("actRole")?.value || "",
        returnDate: $("actReturnDate")?.value || "",
        tegner: $("actTegner")?.value || "",
        goal: $("actGoal")?.value || ""
      },

      faam: {
        rawR: $("faamRawR")?.value || "",
        pctR: $("faamPctR")?.value || "",
        rawL: $("faamRawL")?.value || "",
        pctL: $("faamPctL")?.value || "",
        comment: $("faamComment")?.value || "",
        source: $("faamSource")?.value || ""
      },

      autoSummary: $("autoSummary")?.value || ""
    };
  }

  function rowKV(label, value) {
    return `<tr><th style="width:35%">${label}</th><td>${value || ""}</td></tr>`;
  }

  function forceRowsToHTML(rows, sideLesion, unit) {
    const visible = rows.filter(r => r.nr || r.rbest || r.lbest || r.r1 || r.l1 || r.comment);
    if (!visible.length) return "<div>Aucune donnée de force saisie.</div>";

    const rightHead = (sideLesion === "Droite" || sideLesion === "Bilatéral") ? "Droite (lésé)" : "Droite";
    const leftHead = (sideLesion === "Gauche" || sideLesion === "Bilatéral") ? "Gauche (lésé)" : "Gauche";

    const trs = visible.map(r => `
      <tr>
        <td>${r.test}</td>
        <td>${r.mode || ""}</td>
        <td>${r.nr ? "NR" : ""}</td>
        <td>${r.nrReason || ""}</td>
        <td>${r.rbest || ""}</td>
        <td>${r.lbest || ""}</td>
        <td>${r.delta || ""}</td>
        <td>${r.lsi || ""}</td>
        <td>${r.rpain || ""}</td>
        <td>${r.lpain || ""}</td>
        <td>${(r.comment || "").replace(/</g,"&lt;")}</td>
      </tr>
    `).join("");

    return `
      <table>
        <thead>
          <tr>
            <th>Bloc</th><th>Mode</th><th>NR</th><th>Motif</th>
            <th>Retenu ${rightHead} (${unit})</th>
            <th>Retenu ${leftHead} (${unit})</th>
            <th>Delta</th><th>LSI %</th>
            <th>Douleur D</th><th>Douleur G</th><th>Commentaire</th>
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
    const rightHead = (d.sideLesion === "Droite" || d.sideLesion === "Bilatéral") ? "Droite (lésé)" : "Droite";
    const leftHead = (d.sideLesion === "Gauche" || d.sideLesion === "Bilatéral") ? "Gauche (lésé)" : "Gauche";

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
        <table><tbody>
          ${rowKV("Ottawa auto", d.triage.ottConclusionAuto)}
          ${rowKV("Syndesmose auto", d.triage.synConclusionAuto)}
          ${rowKV("Antécédents", [
            d.hxSprain && `ATCD entorse: ${d.hxSprain}`,
            d.hxCount && `Nb: ${d.hxCount}`,
            d.hxSide && `Côté: ${d.hxSide}`,
            d.hxInstab && `Instabilité: ${d.hxInstab}`,
            d.hxFree
          ].filter(Boolean).join(" | "))}
          ${rowKV("Conclusion triage", d.triage.triageFreeConclusion)}
        </tbody></table>
      </div>

      <div class="ps-card">
        <h2>Douleur / œdème / ROM / Arthro</h2>
        <table><tbody>
          ${rowKV("Douleur repos / appui / marche", [d.pain.repos,d.pain.appui,d.pain.marche].filter(Boolean).join(" / "))}
          ${rowKV("Douleur course / saut / actuelle", [d.pain.course,d.pain.saut,d.pain.actuelle].filter(Boolean).join(" / "))}
          ${rowKV("Localisation douleur", d.pain.locationFree)}
          ${rowKV("Figure-of-eight L / S / Delta (cm)", [d.edema.lesion,d.edema.healthy,d.edema.delta].filter(v=>v!=="").join(" / "))}
          ${rowKV("Lunge cm L / S / Delta", [d.lunge.cmL,d.lunge.cmS,d.lunge.cmDelta].filter(v=>v!=="").join(" / "))}
          ${rowKV("Lunge ° L / S / Delta", [d.lunge.degL,d.lunge.degS,d.lunge.degDelta].filter(v=>v!=="").join(" / "))}
          ${rowKV("Note ROM", d.lunge.note)}
          ${rowKV("Glide postérieur", [d.glide.measureText,d.glide.comment].filter(Boolean).join(" | "))}
          ${rowKV("Glide quali L / S + EVA", `${d.glide.lesionQual || ""} (${d.glide.lesionPain || ""}) / ${d.glide.healthyQual || ""} (${d.glide.healthyPain || ""})`)}
        </tbody></table>
      </div>

      <div class="ps-card">
        <h2>Force (${d.unit})</h2>
        <div style="font-size:11px; margin-bottom:6px;">Repères : ${rightHead} / ${leftHead}</div>
        ${forceRowsToHTML(d.force.rows, d.sideLesion, d.unit)}
        <table style="margin-top:8px">
          <tbody>
            ${rowKV("Single calf raise", [
              `${rightHead}: ${d.force.calfStd.right || ""}`,
              `${leftHead}: ${d.force.calfStd.left || ""}`,
              d.force.calfStd.delta && `Delta: ${d.force.calfStd.delta}`,
              d.force.calfStd.lsi && `LSI: ${d.force.calfStd.lsi}%`,
              d.force.calfStd.comment
            ].filter(Boolean).join(" | "))}
            ${rowKV("Single calf raise modifié", [
              `${rightHead}: ${d.force.calfMod.right || ""}`,
              `${leftHead}: ${d.force.calfMod.left || ""}`,
              d.force.calfMod.delta && `Delta: ${d.force.calfMod.delta}`,
              d.force.calfMod.lsi && `LSI: ${d.force.calfMod.lsi}%`,
              d.force.calfMod.comment
            ].filter(Boolean).join(" | "))}
          </tbody>
        </table>
      </div>

      <div class="ps-card">
        <h2>Équilibre</h2>
        <table><tbody>
          ${rowKV("Statique EO (erreurs L / S / Delta)", [d.balance.eoL,d.balance.eoS,d.balance.eoDelta].filter(v=>v!=="").join(" / "))}
          ${rowKV("Statique EC (erreurs L / S / Delta)", [d.balance.ecL,d.balance.ecS,d.balance.ecDelta].filter(v=>v!=="").join(" / "))}
          ${rowKV("Commentaires EO/EC", [d.balance.eoComment,d.balance.ecComment].filter(Boolean).join(" | "))}
          ${rowKV("Dynamique", [d.dyn.type,d.dyn.composite && `Composite ${d.dyn.composite}`,d.dyn.asym].filter(Boolean).join(" | "))}
          ${rowKV("Qualité dynamique", d.dyn.comment)}
        </tbody></table>
      </div>

      <div class="ps-card">
        <h2>Marche / course / activité / PROM</h2>
        <table><tbody>
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
        </tbody></table>
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
    setTimeout(() => document.body.classList.remove("print-summary"), 300);
    isDirty = false;
  }

  function printForm() {
    window.print();
  }

  function resetAll(askConfirm = true) {
    if (askConfirm && !confirm("Effacer toutes les données du bilan en cours ?")) return;

    $$("input, select, textarea").forEach(el => {
      if (el.type === "radio" || el.type === "checkbox") el.checked = false;
      else if (!el.readOnly) el.value = "";
    });

    const modeRadio = document.querySelector('input[name="appMode"][value="ROAST cabinet"]');
    if (modeRadio) modeRadio.checked = true;
    $("hhdUnit").value = "kgf";
    $("thLsi").value = 90;
    $("thEdema").value = 1;
    $("thLungeCm").value = 2;

    ["ottConclusionAuto","synConclusionAuto","edemaDelta","edemaFlag","lungeCmDelta","lungeCmFlag","lungeDegDelta","balEO_Delta","balEC_Delta","jxDisplay"].forEach(id => {
      if ($(id)) $(id).value = "";
    });

    initForceSection();
    initDates();
    updateOttawa();
    updateSyndesmose();
    updateEdema();
    updateLunge();
    updateBalanceStatic();
    refreshAutoSummary();
    updateQfaamQr();

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
    ["traumaDate","evalDate"].forEach(id => $(id)?.addEventListener("change", computeJx));

    ["ottPainMalleolar","ottLatMall","ottMedMall","ottM5","ottNav","ott4steps","ottLimp"].forEach(id => {
      $(id)?.addEventListener("change", updateOttawa);
    });

    ["synPalp","synSqueeze","synER","synDfComp","synPain","synLocation"].forEach(id => {
      $(id)?.addEventListener("change", updateSyndesmose);
      $(id)?.addEventListener("input", updateSyndesmose);
    });

    $("forceContainer")?.addEventListener("input", (e) => {
      const table = e.target.closest("[data-force-table]");
      if (table) recalcForceTable(table);
      if (["calfStdRight","calfStdLeft","calfModRight","calfModLeft"].includes(e.target.id)) {
        recalcCalfRaisePair("std");
        recalcCalfRaisePair("mod");
      }
      refreshAutoSummary();
    });

    $("forceContainer")?.addEventListener("change", (e) => {
      const table = e.target.closest("[data-force-table]");
      if (table) recalcForceTable(table);
      if (["calfStdRight","calfStdLeft","calfModRight","calfModLeft"].includes(e.target.id)) {
        recalcCalfRaisePair("std");
        recalcCalfRaisePair("mod");
      }
      refreshAutoSummary();
    });

    $("hhdUnit")?.addEventListener("change", () => {
      updateForceUnitLabel();
      refreshAutoSummary();
    });

    $("thLsi")?.addEventListener("input", () => {
      recalcAllForceTables();
      recalcCalfRaisePair("std");
      recalcCalfRaisePair("mod");
      refreshAutoSummary();
    });

    $("sideLesion")?.addEventListener("change", () => {
      updateForceLabels();
      recalcAllForceTables();
      recalcCalfRaisePair("std");
      recalcCalfRaisePair("mod");
      updateQfaamQr();
      refreshAutoSummary();
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-summary");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  function boot() {
    bindWizard();
    bindDirtyTracking();
    bindTopButtons();

    initForceSection();
    bindSpecifics();
    bindQfaam();

    initDates();
    updateOttawa();
    updateSyndesmose();
    updateEdema();
    updateLunge();
    updateBalanceStatic();
    refreshAutoSummary();
    updateQfaamQr();

    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
