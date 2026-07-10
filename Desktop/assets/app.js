(function () {
  "use strict";

  const NONE = "__none__";
  const REQUIRED_SELECTS = ["plotCol", "speciesCol", "dbhCol", "heightCol", "statusCol"];
  const STATUS_VALUES = ["live", "dead"];
  const DEAD_DECAY_CULL_PCT = { 1: 0, 2: 10, 3: 30, 4: 50, 5: 70 };
  const COLORS = ["#2f705f", "#2b7a8a", "#b07a25", "#a95035", "#516f45", "#6a5b2b"];
  const TINY_HEIGHT_CLASSES = ["0-1 ft", "1-3 ft", "3-5 ft", ">5 ft"];
  const TINY_HEIGHT_COLORS = ["#E9F5FF", "#A6D4FF", "#4DAAF7", "#1B74D6"];

  const hints = {
    plotCol: ["plot", "plotid", "plot_id", "plot number", "plot_number"],
    speciesCol: ["spp", "spcd", "species", "species_code", "species code", "fia spcd"],
    dbhCol: ["dbh", "dia", "diameter", "diameter breast height"],
    heightCol: ["ht", "height", "totalheight", "total_height", "total height"],
    actualHeightCol: ["actualht", "actual_ht", "actual height", "measured height"],
    cullCol: ["cull", "cull_pct", "cull percent", "defect", "defect_pct"],
    decayCol: ["DECAYCD", "decaycd", "decay class", "decay_class", "decay"],
    statusCol: ["status", "live_dead", "live dead", "condition"],
    crownRatioCol: ["crown_ratio", "crown ratio", "crownratio", "cr", "cr_pct"]
  };

  const regenHints = {
    plot: ["plot", "plotid", "plot_id", "plot number", "plot_number"],
    species: ["spp", "species", "species_name", "common name", "common_name"],
    stems: ["Stem Count", "stem_count", "stems", "stem count", "count"],
    diameterClass: ["Diameter Class", "diameter_class", "diameter class", "diam class"],
    heightClass: ["Height Class", "height_class", "height class", "seedling height"]
  };

  const state = {
    headers: [],
    rows: [],
    fileName: "",
    eco: null,
    result: null,
    refSpecies: [],
    refBySpcd: new Map(),
    refByJenkins: new Map(),
    provinceToDivision: new Map(),
    divisionToProvinces: new Map(),
    regen: {
      headers: [],
      rows: [],
      fileName: "",
      result: null
    }
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "csvFile", "fileStatus", "runForm", "ecoRegionCode", "baf", "dbhClassWidth",
      "runBtn", "resetBtn", "templateBtn", "statusBanner", "summaryCards",
      "downloadAllBtn", "stockCsvBtn", "standCsvBtn", "crownRatioCsvBtn", "auditTxtBtn",
      "overviewDetail", "speciesTpaChart", "speciesBaChart", "dbhTpaChart", "dbhBaChart",
      "stockTable", "standTable", "crownRatioTable", "auditReport", "regenCsvFile", "regenFileStatus",
      "regenExpansionFactor", "regenRunBtn", "regenDownloadBtn", "regenSummaryCards",
      "regenSpeciesChart", "regenHeightChart", "regenOverallTable", "regenSpeciesTable",
      "regenHeightTable", "regenAuditReport"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    prepareReferenceData();
    populateEcoRegionCodes();
    populateColumnSelects([]);
    renderEmptyResults();
    renderEmptyRegen();

    els.csvFile.addEventListener("change", handleFile);
    els.runForm.addEventListener("submit", handleRun);
    els.resetBtn.addEventListener("click", resetApp);
    els.templateBtn.addEventListener("click", downloadTemplate);
    els.downloadAllBtn.addEventListener("click", () => {
      if (!state.result) return;
      downloadBlob(makeZip(buildOutputFiles(state.result)), "PlotWeasel_outputs.zip");
    });
    els.stockCsvBtn.addEventListener("click", () => downloadNamedOutput("combined_stock_table_gross_sound.csv"));
    els.standCsvBtn.addEventListener("click", () => downloadNamedOutput("stand_totals_by_dbh.csv"));
    els.crownRatioCsvBtn.addEventListener("click", () => downloadNamedOutput("species_crown_ratio_summary.csv"));
    els.auditTxtBtn.addEventListener("click", () => downloadNamedOutput("data_audit.txt"));
    els.regenCsvFile.addEventListener("change", handleRegenFile);
    els.regenRunBtn.addEventListener("click", runRegenFromState);
    els.regenDownloadBtn.addEventListener("click", () => {
      if (!state.regen.result) return;
      downloadBlob(makeZip(buildTinyOutputFiles(state.regen.result)), "TinyWeasel_regen_outputs.zip");
    });

    document.querySelectorAll("input[name='ecoRegionType']").forEach((input) => {
      input.addEventListener("change", populateEcoRegionCodes);
    });

    document.querySelectorAll("[data-column-select]").forEach((select) => {
      select.addEventListener("change", updateRunButton);
    });

    document.querySelectorAll(".tab[data-tab]").forEach((button) => {
      button.addEventListener("click", () => activateTab(button.dataset.tab));
    });

    document.querySelectorAll(".graph-tab[data-graph]").forEach((button) => {
      button.addEventListener("click", () => activateGraph(button.dataset.graph));
    });
    document.querySelectorAll(".graph-tab[data-regen-graph]").forEach((button) => {
      button.addEventListener("click", () => activateRegenGraph(button.dataset.regenGraph));
    });

    maybeLoadSampleFromUrl();
  }

  function prepareReferenceData() {
    const data = window.PLOTWEASEL_NSVB_DATA;
    if (!data) {
      setBanner("error", "Missing data", "The bundled NSVB lookup data did not load.");
      return;
    }

    state.refSpecies = data.refSpecies
      .map((row) => ({
        SPCD: toNumber(row.SPCD),
        COMMON_NAME: clean(row.COMMON_NAME),
        JENKINS_SPGRPCD: toNumber(row.JENKINS_SPGRPCD)
      }))
      .filter((row) => Number.isFinite(row.SPCD) && row.SPCD <= 999);

    state.refBySpcd = new Map();
    state.refByJenkins = new Map();
    state.refSpecies.forEach((row) => {
      state.refBySpcd.set(row.SPCD, row);
      if (Number.isFinite(row.JENKINS_SPGRPCD)) {
        if (!state.refByJenkins.has(row.JENKINS_SPGRPCD)) state.refByJenkins.set(row.JENKINS_SPGRPCD, []);
        state.refByJenkins.get(row.JENKINS_SPGRPCD).push(row);
      }
    });

    data.ecoDivProv.forEach((row) => {
      const division = clean(row.eco_division);
      const province = clean(row.eco_province);
      if (!division || !province) return;
      state.provinceToDivision.set(province, division);
      if (!state.divisionToProvinces.has(division)) state.divisionToProvinces.set(division, []);
      state.divisionToProvinces.get(division).push(province);
    });
  }

  function populateEcoRegionCodes() {
    const type = getEcoRegionType();
    const prior = els.ecoRegionCode.value;
    els.ecoRegionCode.innerHTML = "";

    if (type === "PROVINCE") {
      const provinces = Array.from(state.provinceToDivision.keys()).sort(compareCodes);
      provinces.forEach((province) => {
        const division = state.provinceToDivision.get(province);
        addOption(els.ecoRegionCode, province, `${province} (Division ${division})`);
      });
      els.ecoRegionCode.value = provinces.includes(prior) ? prior : (provinces.includes("221") ? "221" : provinces[0]);
    } else {
      const divisions = Array.from(state.divisionToProvinces.keys()).sort(compareCodes);
      divisions.forEach((division) => {
        const provinces = state.divisionToProvinces.get(division).sort(compareCodes).join(", ");
        addOption(els.ecoRegionCode, division, `${division} (Provinces ${provinces})`);
      });
      els.ecoRegionCode.value = divisions.includes(prior) ? prior : (divisions.includes("220") ? "220" : divisions[0]);
    }
  }

  async function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error("The CSV did not contain a header row and at least one data row.");
      }

      loadCsvTextIntoState(text, file.name);
      setBanner("success", "CSV loaded", `${parsed.headers.length} columns found. Review the column matches and run the calculation.`);
    } catch (error) {
      state.headers = [];
      state.rows = [];
      state.fileName = "";
      populateColumnSelects([]);
      updateRunButton();
      setBanner("error", "CSV problem", error.message);
    }
  }

  function loadCsvTextIntoState(text, fileName) {
    const parsed = parseCsv(text);
    if (!parsed.headers.length || !parsed.rows.length) {
      throw new Error("The CSV did not contain a header row and at least one data row.");
    }
    state.headers = parsed.headers;
    state.rows = parsed.rows;
    state.fileName = fileName || "uploaded.csv";
    state.result = null;
    populateColumnSelects(parsed.headers);
    els.fileStatus.textContent = `${state.fileName} | ${parsed.rows.length.toLocaleString()} records`;
    clearResults();
    updateRunButton();
    return parsed;
  }

  async function maybeLoadSampleFromUrl() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sample") !== "1") return;
    try {
      const response = await fetch("PlotWeasel_CSV_template.csv", { cache: "no-store" });
      if (!response.ok) throw new Error("Sample CSV could not be loaded.");
      const text = await response.text();
      loadCsvTextIntoState(text, "PlotWeasel_CSV_template.csv");
      setBanner("success", "Sample CSV loaded", "The bundled sample rows are ready.");
      if (url.searchParams.get("autorun") === "1") {
        const result = runPlotWeasel(state.rows, readParams());
        state.result = result;
        renderResults(result);
        enableDownloads(true);
        setBanner("success", "Calculation complete", `${result.dat1.length.toLocaleString()} live/dead records processed across ${result.nPlots.toLocaleString()} plots.`);
      }
    } catch (error) {
      setBanner("error", "Sample load failed", error.message);
    }
  }

  function populateColumnSelects(headers) {
    document.querySelectorAll("[data-column-select]").forEach((select) => {
      const required = select.dataset.required === "true";
      const currentHints = hints[select.id] || [];
      select.innerHTML = "";
      addOption(select, NONE, required ? "Select column" : "Not in file");
      headers.forEach((header) => addOption(select, header, header));
      select.disabled = headers.length === 0;

      const match = findColumn(headers, currentHints);
      if (match) {
        select.value = match;
      } else {
        select.value = NONE;
      }
    });
  }

  function updateRunButton() {
    const hasFile = state.rows.length > 0;
    const hasRequired = REQUIRED_SELECTS.every((id) => {
      const select = document.getElementById(id);
      return select && select.value && select.value !== NONE;
    });
    els.runBtn.disabled = !(hasFile && hasRequired);
  }

  function handleRun(event) {
    event.preventDefault();
    if (!state.rows.length) return;

    try {
      const params = readParams();
      const result = runPlotWeasel(state.rows, params);
      state.result = result;
      renderResults(result);
      setBanner("success", "Calculation complete", `${result.dat1.length.toLocaleString()} live/dead records processed across ${result.nPlots.toLocaleString()} plots.`);
      enableDownloads(true);
    } catch (error) {
      state.result = null;
      enableDownloads(false);
      setBanner("error", "Calculation stopped", error.message);
    }
  }

  async function handleRegenFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      loadRegenTextIntoState(text, file.name);
      setBanner("success", "Regen CSV loaded", `${state.regen.rows.length.toLocaleString()} regen records found.`);
    } catch (error) {
      state.regen.headers = [];
      state.regen.rows = [];
      state.regen.fileName = "";
      state.regen.result = null;
      els.regenFileStatus.textContent = "Choose a .csv file";
      updateRegenRunButton();
      renderEmptyRegen();
      setBanner("error", "Regen CSV problem", error.message);
    }
  }

  function loadRegenTextIntoState(text, fileName) {
    const parsed = parseCsv(text);
    if (!parsed.headers.length || !parsed.rows.length) {
      throw new Error("The regen CSV did not contain a header row and at least one data row.");
    }
    state.regen.headers = parsed.headers;
    state.regen.rows = parsed.rows;
    state.regen.fileName = fileName || "regen.csv";
    state.regen.result = null;
    els.regenFileStatus.textContent = `${state.regen.fileName} | ${parsed.rows.length.toLocaleString()} records`;
    updateRegenRunButton();
    renderEmptyRegen();
    return parsed;
  }

  function updateRegenRunButton() {
    els.regenRunBtn.disabled = state.regen.rows.length === 0;
    els.regenDownloadBtn.disabled = !state.regen.result;
  }

  function runRegenFromState() {
    if (!state.regen.rows.length) return;
    try {
      const expansionFactor = toNumber(els.regenExpansionFactor.value);
      if (!Number.isFinite(expansionFactor) || expansionFactor <= 0) {
        throw new Error("Expansion factor must be greater than zero.");
      }
      const result = runTinyWeasel(state.regen.rows, state.regen.headers, {
        expansionFactor,
        fileName: state.regen.fileName
      });
      state.regen.result = result;
      renderRegenResults(result);
      updateRegenRunButton();
      setBanner("success", "Regen calculation complete", `${result.measuredRows.length.toLocaleString()} regen records processed across ${result.plotList.length.toLocaleString()} plots.`);
    } catch (error) {
      state.regen.result = null;
      updateRegenRunButton();
      renderEmptyRegen();
      setBanner("error", "Regen calculation stopped", error.message);
    }
  }

  function readParams() {
    const baf = toNumber(els.baf.value);
    const dbhClassWidth = toNumber(els.dbhClassWidth.value);
    if (!Number.isFinite(baf) || baf <= 0) throw new Error("BAF must be greater than zero.");
    if (!Number.isFinite(dbhClassWidth) || dbhClassWidth <= 0) throw new Error("DBH class width must be greater than zero.");

    const eco = getEcoContext();
    if (!eco.division) throw new Error("The selected eco region could not be matched to a division.");

    const columns = {
      plot: valueOfSelect("plotCol"),
      species: valueOfSelect("speciesCol"),
      dbh: valueOfSelect("dbhCol"),
      height: valueOfSelect("heightCol"),
      actualHeight: valueOfSelect("actualHeightCol"),
      cull: valueOfSelect("cullCol"),
      decay: valueOfSelect("decayCol"),
      status: valueOfSelect("statusCol"),
      crownRatio: valueOfSelect("crownRatioCol")
    };

    ["plot", "species", "dbh", "height", "status"].forEach((key) => {
      if (!columns[key]) throw new Error(`Select a CSV column for ${key}.`);
    });

    return { baf, dbhClassWidth, eco, columns };
  }

  function valueOfSelect(id) {
    const value = document.getElementById(id).value;
    return value && value !== NONE ? value : null;
  }

  function getEcoRegionType() {
    const checked = document.querySelector("input[name='ecoRegionType']:checked");
    return checked ? checked.value : "PROVINCE";
  }

  function getEcoContext() {
    const type = getEcoRegionType();
    const code = clean(els.ecoRegionCode.value);
    if (type === "PROVINCE") {
      return {
        type,
        code,
        primaryCol: "PROVINCE",
        province: code,
        division: state.provinceToDivision.get(code) || ""
      };
    }
    const provinces = state.divisionToProvinces.get(code) || [];
    return {
      type,
      code,
      primaryCol: "DIVISION",
      division: code,
      province: provinces[0] || ""
    };
  }

  function runPlotWeasel(rawRows, params) {
    const data = window.PLOTWEASEL_NSVB_DATA;
    const audit = {
      rawCount: rawRows.length,
      precheck: {},
      nsvbDropped: [],
      baseDropped: [],
      statusDropped: [],
      fileName: state.fileName,
      params
    };

    const treeBefore = rawRows.map((row, index) => standardizeRow(row, index, params.columns));
    const nullPlotRows = treeBefore.filter(isNullPlotPlaceholder);
    const nullPlotRowIndexes = new Set(nullPlotRows.map((row) => row.rowIndex));
    const treeRowsForPrecheck = treeBefore.filter((row) => !nullPlotRowIndexes.has(row.rowIndex));
    const plots = uniqueSorted(treeBefore.map((row) => row.plot).filter(Boolean), compareMixed);
    audit.nullPlots = uniqueSorted(nullPlotRows.map((row) => row.plot || "null"), compareMixed);
    audit.nullPlotCount = audit.nullPlots.length;
    audit.precheck = {
      missingStatus: treeRowsForPrecheck.filter((row) => !row.statusRaw).length,
      missingDbh: treeRowsForPrecheck.filter((row) => !Number.isFinite(row.DIA) || row.DIA <= 0).length,
      missingHeight: treeRowsForPrecheck.filter((row) => !Number.isFinite(row.HT)).length,
      missingSpecies: treeRowsForPrecheck.filter((row) => !Number.isFinite(row.SPCD)).length
    };

    const ibMap = buildCoefficientMap(data.volIbSpcd, data.volIbJenkins, params.eco);
    const bkMap = buildCoefficientMap(data.volBkSpcd, data.volBkJenkins, params.eco);
    const tree = [];

    treeBefore.forEach((row) => {
      const ib = ibMap.get(row.SPCD);
      const bk = bkMap.get(row.SPCD);
      if (!ib || !bk) {
        if (!nullPlotRowIndexes.has(row.rowIndex)) {
          audit.nsvbDropped.push({
            plot: row.plot,
            SPCD: row.SPCD,
            DIA: row.DIA,
            HT: row.HT,
            reason: !ib && !bk ? "No inside-bark or bark coefficient" : (!ib ? "No inside-bark coefficient" : "No bark coefficient")
          });
        }
        return;
      }

      const vIbGross = getNsvb(ib.MODEL, row.SPCD, row.DIA, row.HT, ib.a, ib.a1, ib.b, ib.b1, ib.c, ib.c1, NaN);
      const vBkGross = getNsvb(bk.MODEL, row.SPCD, row.DIA, row.HT, bk.a, bk.a1, bk.b, bk.b1, bk.c, bk.c1, NaN);
      const vObGross = safeAdd(vIbGross, vBkGross);
      const cull = clampPercent(row.CULL);
      const actualHeight = Number.isFinite(row.ACTUALHT) ? row.ACTUALHT : row.HT;
      const decayCullPct = Number.isFinite(row.DECAYCD) ? (DEAD_DECAY_CULL_PCT[row.DECAYCD] || 0) : 0;
      const decayUsedForSound = row.status === "dead" && cull === 0 && decayCullPct > 0;
      const soundCullPct = decayUsedForSound ? decayCullPct : cull;
      const soundHeightFactor = Number.isFinite(actualHeight) && Number.isFinite(row.HT) && row.HT > 0 ? actualHeight / row.HT : 1;
      const vIbSoundFull = Number.isFinite(vIbGross) ? vIbGross * (1 - soundCullPct / 100) : NaN;
      const vBkSoundFull = vBkGross;
      const vIbSound = Number.isFinite(vIbSoundFull) ? vIbSoundFull * soundHeightFactor : NaN;
      const vBkSound = Number.isFinite(vBkSoundFull) ? vBkSoundFull * soundHeightFactor : NaN;
      const vObSound = safeAdd(vIbSound, vBkSound);
      const ref = state.refBySpcd.get(row.SPCD);
      const spp = ref && ref.COMMON_NAME ? ref.COMMON_NAME : String(row.SPCD);

      tree.push({
        ...row,
        CULL: cull,
        DECAY_CULL_PCT: decayCullPct,
        DECAYCD_USED_FOR_SOUND: decayUsedForSound,
        SOUND_CULL_PCT: soundCullPct,
        SOUND_HEIGHT_FACTOR: soundHeightFactor,
        ACTUALHT: actualHeight,
        DIVISION: params.eco.division,
        PROVINCE: params.eco.province,
        spp,
        V_tot_ib_Gross: vIbGross,
        V_tot_bk_Gross: vBkGross,
        V_tot_ob_Gross: vObGross,
        V_tot_ib_Sound: vIbSound,
        V_tot_bk_Sound: vBkSound,
        V_tot_ob_Sound: vObSound
      });
    });

    const deadTreeRows = tree.filter((row) => row.status === "dead");
    audit.deadDecay = {
      dead_tree_records: deadTreeRows.length,
      missing_DECAYCD: deadTreeRows.filter((row) => !Number.isFinite(row.DECAYCD)).length,
      DECAYCD_used_for_sound: deadTreeRows.filter((row) => row.DECAYCD_USED_FOR_SOUND).length,
      dead_trees_with_field_CULL: deadTreeRows.filter((row) => Number.isFinite(row.CULL) && row.CULL > 0).length
    };

    const dat1Raw = tree.map((row) => ({ ...row, dbh: row.DIA }));
    const dat1Base = dat1Raw.filter((row) => row.plot && row.spp && Number.isFinite(row.dbh) && row.dbh > 0);
    const baseKept = new Set(dat1Base.map((row) => row.rowIndex));
    audit.baseDropped = dat1Raw
      .filter((row) => !baseKept.has(row.rowIndex))
      .map((row) => ({
        plot: row.plot,
        spp: row.spp,
        dbh: row.dbh,
        reason: "Missing plot/species/DBH or DBH <= 0"
      }));

    const dat1PreStatus = dat1Base.map((row) => {
      const dbh = row.dbh;
      const baFt2 = 0.005454 * Math.pow(dbh, 2);
      return {
        ...row,
        status: row.status,
        BA_ft2: baFt2,
        TPA_tree: params.baf / baFt2,
        BAac_tree: (params.baf / baFt2) * baFt2
      };
    });

    const dat1 = dat1PreStatus.filter((row) => STATUS_VALUES.includes(row.status));
    const statusKept = new Set(dat1.map((row) => row.rowIndex));
    audit.statusDropped = dat1PreStatus
      .filter((row) => !statusKept.has(row.rowIndex))
      .map((row) => ({
        plot: row.plot,
        SPCD: row.SPCD,
        DIA: row.DIA,
        status: row.statusRaw,
        reason: "Status is not live or dead"
      }));

    const species = uniqueSorted(dat1.map((row) => row.spp).filter(Boolean), compareMixed);
    const nPlots = plots.length;

    if (!tree.length) throw new Error("No rows could be matched to NSVB volume coefficients.");
    if (!nPlots) throw new Error("No plot values were available after processing.");
    if (!dat1.length) throw new Error("No records with live or dead status remained after filtering.");

    const statusSummary = summarizeStatus(dat1, plots, params.baf);
    const speciesStatusSummary = summarizeSpeciesStatus(dat1, plots, species, params.baf);
    const speciesSummary = summarizeSpecies(dat1, plots, species, params.baf);
    const crownRatioSummary = summarizeCrownRatio(dat1, species);
    const totalSummary = summarizeTotals(dat1, plots, params.baf);
    const stockTable = buildStockTable(speciesSummary, totalSummary);
    const stand = buildStandTables(dat1, plots, species, params.dbhClassWidth);
    const perTreeVolumes = tree
      .map((row) => pick(row, [
        "plot", "spp", "SPCD", "DIA", "HT", "ACTUALHT", "CULL", "DECAYCD",
        "DECAY_CULL_PCT", "SOUND_CULL_PCT", "SOUND_HEIGHT_FACTOR", "statusRaw", "status",
        "V_tot_ib_Gross", "V_tot_bk_Gross", "V_tot_ob_Gross",
        "V_tot_ib_Sound", "V_tot_bk_Sound", "V_tot_ob_Sound"
      ]))
      .sort((a, b) => compareMixed(a.plot, b.plot) || compareMixed(a.spp, b.spp) || numericSort(a.DIA, b.DIA));

    return {
      params,
      audit,
      tree,
      dat1,
      plots,
      species,
      nPlots,
      statusSummary,
      speciesStatusSummary,
      speciesSummary,
      crownRatioSummary,
      totalSummary,
      stockTable,
      standTable: stand.standTable,
      standTotal: stand.standTotal,
      perTreeVolumes
    };
  }

  function standardizeRow(row, index, columns) {
    const ht = toNumber(row[columns.height]);
    const actual = columns.actualHeight ? toNumber(row[columns.actualHeight]) : NaN;
    return {
      rowIndex: index,
      plot: clean(row[columns.plot]),
      SPCD: toNumber(row[columns.species]),
      DIA: toNumber(row[columns.dbh]),
      HT: ht,
      ACTUALHT: Number.isFinite(actual) ? actual : ht,
      CULL: columns.cull ? toNumber(row[columns.cull]) : 0,
      DECAYCD: columns.decay ? normalizeDecayCode(row[columns.decay]) : NaN,
      crown_ratio: columns.crownRatio ? toNumber(row[columns.crownRatio]) : NaN,
      statusRaw: clean(row[columns.status]),
      status: normalizeStatus(row[columns.status])
    };
  }

  function isNullPlotPlaceholder(row) {
    return Boolean(row.plot) &&
      !Number.isFinite(row.SPCD) &&
      !Number.isFinite(row.DIA) &&
      !Number.isFinite(row.HT) &&
      !row.statusRaw;
  }

  function runTinyWeasel(rawRows, headers, options) {
    const columns = {
      plot: findColumn(headers, regenHints.plot),
      species: findColumn(headers, regenHints.species),
      stems: findColumn(headers, regenHints.stems),
      diameterClass: findColumn(headers, regenHints.diameterClass),
      heightClass: findColumn(headers, regenHints.heightClass)
    };
    if (!columns.plot) throw new Error("The regen CSV needs a plot column.");
    if (!columns.species) throw new Error("The regen CSV needs an spp/species column.");
    if (!columns.stems) throw new Error("The regen CSV needs a Stem Count column.");
    if (!columns.heightClass) throw new Error("The regen CSV needs a Height Class column.");

    const standardized = rawRows.map((row, index) => standardizeRegenRow(row, index, columns));
    const nullIds = [];
    const nullPlotLabels = [];
    const plotList = [];

    standardized.forEach((row) => {
      if (!row.plot) return;
      if (clean(row.plot).toLowerCase() === "null") {
        const id = `null_${nullIds.length + 1}`;
        nullIds.push(id);
        nullPlotLabels.push(id);
        plotList.push(id);
        return;
      }
      if (!plotList.includes(row.plot)) plotList.push(row.plot);
      if (isRegenNullPlotPlaceholder(row) && !nullPlotLabels.includes(row.plot)) {
        nullPlotLabels.push(row.plot);
      }
    });

    if (!plotList.length) throw new Error("No plot values were available in the regen CSV.");

    const measuredRows = standardized
      .filter((row) => !isRegenNullPlotPlaceholder(row))
      .filter((row) => row.plot && row.species && Number.isFinite(row.stems));

    const droppedRows = standardized
      .filter((row) => !isRegenNullPlotPlaceholder(row))
      .filter((row) => !(row.plot && row.species && Number.isFinite(row.stems)))
      .map((row) => ({
        row: row.rowIndex + 2,
        plot: row.plot,
        species: row.species,
        stems: row.stems,
        reason: "Missing plot, species, or stem count"
      }));

    const species = uniqueSorted(measuredRows.map((row) => row.species).filter(Boolean), compareMixed);
    const extraHeightClasses = uniqueSorted(
      measuredRows
        .map((row) => row.height_class)
        .filter((value) => value && !TINY_HEIGHT_CLASSES.includes(value)),
      compareMixed
    );
    const heightClasses = TINY_HEIGHT_CLASSES.concat(extraHeightClasses);
    const expansionFactor = options.expansionFactor;
    const tpaByPlot = plotList.map((plot) => ({
      plot,
      tpa_plot: measuredRows
        .filter((row) => row.plot === plot)
        .reduce((sum, row) => sum + finiteOrZero(row.stems), 0) * expansionFactor
    }));

    const overallMeanTpa = [{
      mean_tpa: mean(tpaByPlot.map((row) => row.tpa_plot)),
      n_plots: plotList.length
    }];

    const speciesMeanTpa = species.map((spp) => {
      const values = plotList.map((plot) => measuredRows
        .filter((row) => row.plot === plot && row.species === spp)
        .reduce((sum, row) => sum + finiteOrZero(row.stems), 0) * expansionFactor);
      return { species: spp, mean_tpa: mean(values), n_plots: plotList.length };
    }).sort((a, b) => finiteOrZero(b.mean_tpa) - finiteOrZero(a.mean_tpa));

    const speciesHeightMeanTpa = [];
    species.forEach((spp) => {
      heightClasses.forEach((heightClass) => {
        const values = plotList.map((plot) => measuredRows
          .filter((row) => row.plot === plot && row.species === spp && row.height_class === heightClass)
          .reduce((sum, row) => sum + finiteOrZero(row.stems), 0) * expansionFactor);
        speciesHeightMeanTpa.push({
          species: spp,
          height_class: heightClass,
          mean_tpa: mean(values)
        });
      });
    });

    return {
      fileName: options.fileName,
      columns,
      expansionFactor,
      plotList,
      nullPlots: nullPlotLabels,
      nullPlotCount: nullPlotLabels.length,
      heightClasses,
      measuredRows,
      droppedRows,
      tpaByPlot,
      overallMeanTpa,
      speciesMeanTpa,
      speciesHeightMeanTpa
    };
  }

  function standardizeRegenRow(row, index, columns) {
    const plot = clean(row[columns.plot]);
    const heightClass = normalizeHeightClass(row[columns.heightClass]);
    return {
      rowIndex: index,
      plot,
      species: clean(row[columns.species]),
      stems: toNumber(row[columns.stems]),
      diameter_class: columns.diameterClass ? clean(row[columns.diameterClass]) : "",
      diameter_in: columns.diameterClass ? parseFirstNumber(row[columns.diameterClass]) : NaN,
      height_class: heightClass
    };
  }

  function isRegenNullPlotPlaceholder(row) {
    return Boolean(row.plot) &&
      (clean(row.plot).toLowerCase() === "null" ||
        (!row.species && !Number.isFinite(row.stems) && !row.diameter_class && !row.height_class));
  }

  function normalizeHeightClass(value) {
    const text = clean(value).replace(/[–—]/g, "-");
    const normalized = TINY_HEIGHT_CLASSES.find((item) => normalizeName(item) === normalizeName(text));
    return normalized || text;
  }

  function parseFirstNumber(value) {
    const match = clean(value).match(/-?\d+(\.\d+)?/);
    return match ? toNumber(match[0]) : NaN;
  }

  function buildCoefficientMap(spRows, jenkinsRows, eco) {
    const selectedSp = selectBestPerSpecies(spRows.map(normalizeCoefRow), eco);
    const spcdWithSpeciesCoef = new Set(selectedSp.map((row) => row.SPCD));
    const expandedJenkins = [];

    jenkinsRows.map(normalizeCoefRow).forEach((coef) => {
      const speciesRows = state.refByJenkins.get(coef.JENKINS_SPGRPCD) || [];
      speciesRows.forEach((species) => {
        if (spcdWithSpeciesCoef.has(species.SPCD)) return;
        expandedJenkins.push({
          ...coef,
          SPCD: species.SPCD,
          a1: NaN,
          b1: NaN,
          c1: NaN
        });
      });
    });

    const selectedJenkins = selectBestPerSpecies(expandedJenkins, eco);
    const map = new Map();
    selectedSp.concat(selectedJenkins).forEach((row) => map.set(row.SPCD, row));
    return map;
  }

  function normalizeCoefRow(row, index) {
    return {
      order: index || 0,
      SPCD: toNumber(row.SPCD),
      JENKINS_SPGRPCD: toNumber(row.JENKINS_SPGRPCD),
      DIVISION: clean(row.DIVISION || row.division || row.eco_division),
      PROVINCE: clean(row.PROVINCE || row.province || row.eco_province),
      MODEL: toNumber(row.MODEL || row.model),
      a: toNumber(row.a),
      a1: toNumber(row.a1),
      b: toNumber(row.b),
      b1: toNumber(row.b1),
      c: toNumber(row.c),
      c1: toNumber(row.c1)
    };
  }

  function selectBestPerSpecies(rows, eco) {
    const best = new Map();
    rows.forEach((row, order) => {
      if (!Number.isFinite(row.SPCD)) return;
      const priority = coefficientPriority(row, eco);
      if (priority <= 0) return;
      const current = best.get(row.SPCD);
      if (!current || priority > current.priority || (priority === current.priority && order < current.order)) {
        best.set(row.SPCD, { ...row, priority, order });
      }
    });
    return Array.from(best.values()).map((row) => {
      const clone = { ...row };
      delete clone.priority;
      delete clone.order;
      return clone;
    });
  }

  function coefficientPriority(row, eco) {
    const hasDivision = row.DIVISION !== "";
    const hasProvince = row.PROVINCE !== "";
    const hasRegionColumn = Object.prototype.hasOwnProperty.call(row, "DIVISION") || Object.prototype.hasOwnProperty.call(row, "PROVINCE");

    if (eco.primaryCol === "PROVINCE" && hasProvince) {
      return row.PROVINCE === eco.province ? 2 : 0;
    }
    if (eco.primaryCol === "DIVISION" && hasDivision) {
      return row.DIVISION === eco.division ? 2 : 0;
    }
    if (hasDivision && eco.division) {
      return row.DIVISION === eco.division ? 2 : 0;
    }
    if (hasProvince && eco.province) {
      return row.PROVINCE === eco.province ? 2 : 0;
    }
    if (hasRegionColumn && !hasDivision && !hasProvince) {
      return 1;
    }
    return hasRegionColumn ? 0 : 1;
  }

  function getNsvb(model, spcd, dia, ht, a, a1, b, b1, c, c1, wdsg) {
    if (![model, spcd, dia, ht, a, b, c].every(Number.isFinite)) return NaN;
    if (model === 1) {
      return a * Math.pow(dia, b) * Math.pow(ht, c);
    }
    if (model === 2 && spcd < 300 && dia < 9) {
      return a * Math.pow(dia, b) * Math.pow(ht, c);
    }
    if (model === 2 && spcd < 300 && dia >= 9) {
      return Number.isFinite(b1) ? a * Math.pow(9, b - b1) * Math.pow(dia, b1) * Math.pow(ht, c) : NaN;
    }
    if (model === 2 && spcd >= 300 && dia < 11) {
      return a * Math.pow(dia, b) * Math.pow(ht, c);
    }
    if (model === 2 && spcd >= 300 && dia >= 11) {
      return Number.isFinite(b1) ? a * Math.pow(11, b - b1) * Math.pow(dia, b1) * Math.pow(ht, c) : NaN;
    }
    if (model === 3) {
      if (![a1, c1].every(Number.isFinite)) return NaN;
      const term = a1 * (1 - Math.exp(-1 * b * dia));
      return a * Math.pow(dia, Math.pow(term, c1)) * Math.pow(ht, c);
    }
    if (model === 4) {
      return Number.isFinite(b1) ? a * Math.pow(dia, b) * Math.pow(ht, c) * Math.exp(-1 * (b1 * dia)) : NaN;
    }
    if (model === 5) {
      return Number.isFinite(wdsg) ? a * Math.pow(dia, b) * Math.pow(ht, c) * wdsg : NaN;
    }
    return NaN;
  }

  function summarizeStatus(dat1, plots, baf) {
    const plotStatus = new Map();
    dat1.forEach((row) => {
      const key = joinKey(row.plot, row.status);
      if (!plotStatus.has(key)) plotStatus.set(key, { plot: row.plot, status: row.status, n: 0, TPA: 0 });
      const group = plotStatus.get(key);
      group.n += 1;
      group.TPA += finiteOrZero(row.TPA_tree);
    });

    const completed = [];
    plots.forEach((plot) => {
      STATUS_VALUES.forEach((status) => {
        const group = plotStatus.get(joinKey(plot, status)) || { n: 0, TPA: 0 };
        completed.push({ plot, status, BA_ac: baf * group.n, TPA: group.TPA });
      });
    });

    return STATUS_VALUES.map((status) => {
      const rows = completed.filter((row) => row.status === status);
      return {
        status,
        ...metricSet(rows, "BA_ac", "BA_ac", plots.length),
        ...metricSet(rows, "TPA", "TPA", plots.length),
        n_plots: plots.length
      };
    });
  }

  function summarizeSpeciesStatus(dat1, plots, species, baf) {
    const map = new Map();
    dat1.forEach((row) => {
      const key = joinKey(row.plot, row.spp, row.status);
      if (!map.has(key)) map.set(key, { plot: row.plot, spp: row.spp, status: row.status, n: 0, TPA: 0 });
      const group = map.get(key);
      group.n += 1;
      group.TPA += finiteOrZero(row.TPA_tree);
    });

    const completed = [];
    plots.forEach((plot) => {
      species.forEach((spp) => {
        STATUS_VALUES.forEach((status) => {
          const group = map.get(joinKey(plot, spp, status)) || { n: 0, TPA: 0 };
          completed.push({ plot, spp, status, BA_ac: baf * group.n, TPA: group.TPA });
        });
      });
    });

    const out = [];
    species.forEach((spp) => {
      STATUS_VALUES.forEach((status) => {
        const rows = completed.filter((row) => row.spp === spp && row.status === status);
        out.push({
          spp,
          status,
          ...metricSet(rows, "BA_ac", "BA_ac", plots.length),
          ...metricSet(rows, "TPA", "TPA", plots.length),
          n_plots: plots.length
        });
      });
    });
    return out.sort((a, b) => compareMixed(a.spp, b.spp) || compareMixed(a.status, b.status));
  }

  function summarizeSpecies(dat1, plots, species, baf) {
    const map = new Map();
    dat1.forEach((row) => {
      const key = joinKey(row.plot, row.spp);
      if (!map.has(key)) {
        map.set(key, {
          plot: row.plot,
          spp: row.spp,
          n: 0,
          TPA: 0,
          VIB_Gross_ac: 0,
          VOB_Gross_ac: 0,
          VIB_Sound_ac: 0,
          VOB_Sound_ac: 0
        });
      }
      const group = map.get(key);
      group.n += 1;
      group.TPA += finiteOrZero(row.TPA_tree);
      group.VIB_Gross_ac += finiteOrZero(row.V_tot_ib_Gross) * finiteOrZero(row.TPA_tree);
      group.VOB_Gross_ac += finiteOrZero(row.V_tot_ob_Gross) * finiteOrZero(row.TPA_tree);
      group.VIB_Sound_ac += finiteOrZero(row.V_tot_ib_Sound) * finiteOrZero(row.TPA_tree);
      group.VOB_Sound_ac += finiteOrZero(row.V_tot_ob_Sound) * finiteOrZero(row.TPA_tree);
    });

    const completed = [];
    plots.forEach((plot) => {
      species.forEach((spp) => {
        const group = map.get(joinKey(plot, spp)) || {
          n: 0,
          TPA: 0,
          VIB_Gross_ac: 0,
          VOB_Gross_ac: 0,
          VIB_Sound_ac: 0,
          VOB_Sound_ac: 0
        };
        completed.push({
          plot,
          spp,
          BA_ac: baf * group.n,
          TPA: group.TPA,
          VIB_Gross_ac: group.VIB_Gross_ac,
          VOB_Gross_ac: group.VOB_Gross_ac,
          VIB_Sound_ac: group.VIB_Sound_ac,
          VOB_Sound_ac: group.VOB_Sound_ac
        });
      });
    });

    return species.map((spp) => {
      const rows = completed.filter((row) => row.spp === spp);
      return {
        spp,
        ...metricSet(rows, "BA_ac", "BA_ac", plots.length),
        ...metricSet(rows, "TPA", "TPA", plots.length),
        ...metricSet(rows, "VIB_Gross_ac", "VIB_Gross", plots.length),
        ...metricSet(rows, "VOB_Gross_ac", "VOB_Gross", plots.length),
        ...metricSet(rows, "VIB_Sound_ac", "VIB_Sound", plots.length),
        ...metricSet(rows, "VOB_Sound_ac", "VOB_Sound", plots.length),
        n_plots: plots.length
      };
    }).sort((a, b) => compareMixed(a.spp, b.spp));
  }

  function summarizeCrownRatio(dat1, species) {
    const plotSpecies = new Map();
    dat1.forEach((row) => {
      if (!Number.isFinite(row.crown_ratio)) return;
      const key = joinKey(row.plot, row.spp);
      if (!plotSpecies.has(key)) plotSpecies.set(key, { spp: row.spp, yi: 0, mi: 0 });
      const group = plotSpecies.get(key);
      group.yi += row.crown_ratio;
      group.mi += 1;
    });

    const bySpecies = new Map();
    Array.from(plotSpecies.values()).forEach((row) => {
      if (!bySpecies.has(row.spp)) bySpecies.set(row.spp, { spp: row.spp, total_yi: 0, total_mi: 0 });
      const group = bySpecies.get(row.spp);
      group.total_yi += row.yi;
      group.total_mi += row.mi;
    });

    return species
      .filter((spp) => bySpecies.has(spp))
      .map((spp) => {
        const group = bySpecies.get(spp);
        return {
          spp,
          crown_ratio_mean: group.total_mi > 0 ? group.total_yi / group.total_mi : NaN,
          total_yi: group.total_yi,
          total_mi: group.total_mi
        };
      })
      .sort((a, b) => compareMixed(a.spp, b.spp));
  }

  function summarizeTotals(dat1, plots, baf) {
    const map = new Map();
    dat1.forEach((row) => {
      if (!map.has(row.plot)) {
        map.set(row.plot, {
          plot: row.plot,
          n: 0,
          TPA: 0,
          VIB_Gross_ac: 0,
          VOB_Gross_ac: 0,
          VIB_Sound_ac: 0,
          VOB_Sound_ac: 0
        });
      }
      const group = map.get(row.plot);
      group.n += 1;
      group.TPA += finiteOrZero(row.TPA_tree);
      group.VIB_Gross_ac += finiteOrZero(row.V_tot_ib_Gross) * finiteOrZero(row.TPA_tree);
      group.VOB_Gross_ac += finiteOrZero(row.V_tot_ob_Gross) * finiteOrZero(row.TPA_tree);
      group.VIB_Sound_ac += finiteOrZero(row.V_tot_ib_Sound) * finiteOrZero(row.TPA_tree);
      group.VOB_Sound_ac += finiteOrZero(row.V_tot_ob_Sound) * finiteOrZero(row.TPA_tree);
    });

    const completed = plots.map((plot) => {
      const group = map.get(plot) || {
        n: 0,
        TPA: 0,
        VIB_Gross_ac: 0,
        VOB_Gross_ac: 0,
        VIB_Sound_ac: 0,
        VOB_Sound_ac: 0
      };
      return {
        plot,
        BA_ac: baf * group.n,
        TPA: group.TPA,
        VIB_Gross_ac: group.VIB_Gross_ac,
        VOB_Gross_ac: group.VOB_Gross_ac,
        VIB_Sound_ac: group.VIB_Sound_ac,
        VOB_Sound_ac: group.VOB_Sound_ac
      };
    });

    return [{
      group: "Total",
      ...metricSet(completed, "BA_ac", "BA_ac", plots.length),
      ...metricSet(completed, "TPA", "TPA", plots.length),
      ...metricSet(completed, "VIB_Gross_ac", "VIB_Gross", plots.length),
      ...metricSet(completed, "VOB_Gross_ac", "VOB_Gross", plots.length),
      ...metricSet(completed, "VIB_Sound_ac", "VIB_Sound", plots.length),
      ...metricSet(completed, "VOB_Sound_ac", "VOB_Sound", plots.length),
      n_plots: plots.length
    }];
  }

  function buildStockTable(speciesSummary, totalSummary) {
    const fields = [
      "group",
      "BA_ac_mean", "BA_ac_se", "BA_ac_cv",
      "TPA_mean", "TPA_se", "TPA_cv",
      "VIB_Gross_mean", "VIB_Gross_se", "VIB_Gross_cv",
      "VOB_Gross_mean", "VOB_Gross_se", "VOB_Gross_cv",
      "VIB_Sound_mean", "VIB_Sound_se", "VIB_Sound_cv",
      "VOB_Sound_mean", "VOB_Sound_se", "VOB_Sound_cv",
      "n_plots"
    ];
    const rows = speciesSummary.map((row) => ({ ...row, group: row.spp })).concat(totalSummary);
    return rows
      .map((row) => pick(row, fields))
      .sort((a, b) => compareMixed(a.group, b.group));
  }

  function buildStandTables(dat1, plots, species, dbhClassWidth) {
    const maxDbh = Math.max.apply(null, dat1.map((row) => row.dbh).filter(Number.isFinite));
    const maxBreak = Math.ceil(maxDbh + dbhClassWidth);
    const classes = [];
    for (let value = 0; value <= maxBreak + 1e-9; value += dbhClassWidth) {
      classes.push(roundForClass(value));
    }

    const usedClasses = new Set();
    const classed = dat1.map((row) => {
      const lower = roundForClass(Math.floor(row.dbh / dbhClassWidth) * dbhClassWidth);
      usedClasses.add(lower);
      return { ...row, dbh_lower: lower };
    });
    const classList = classes.filter((value) => usedClasses.has(value)).sort(numericSort);

    const plotSpeciesClass = new Map();
    classed.forEach((row) => {
      const key = joinKey(row.plot, row.spp, row.dbh_lower);
      if (!plotSpeciesClass.has(key)) plotSpeciesClass.set(key, { plot: row.plot, spp: row.spp, dbh_lower: row.dbh_lower, TPA: 0, BA_ac: 0 });
      const group = plotSpeciesClass.get(key);
      group.TPA += finiteOrZero(row.TPA_tree);
      group.BA_ac += finiteOrZero(row.BAac_tree);
    });

    const standPlot = [];
    plots.forEach((plot) => {
      species.forEach((spp) => {
        classList.forEach((dbhLower) => {
          const group = plotSpeciesClass.get(joinKey(plot, spp, dbhLower)) || { TPA: 0, BA_ac: 0 };
          standPlot.push({ plot, spp, dbh_lower: dbhLower, TPA: group.TPA, BA_ac: group.BA_ac });
        });
      });
    });

    const standTable = [];
    species.forEach((spp) => {
      classList.forEach((dbhLower) => {
        const rows = standPlot.filter((row) => row.spp === spp && row.dbh_lower === dbhLower);
        standTable.push({
          spp,
          dbh_lower: dbhLower,
          ...metricSet(rows, "TPA", "TPA", plots.length),
          ...metricSet(rows, "BA_ac", "BA_ac", plots.length),
          n_plots: plots.length
        });
      });
    });

    const totalByPlotClass = new Map();
    standPlot.forEach((row) => {
      const key = joinKey(row.plot, row.dbh_lower);
      if (!totalByPlotClass.has(key)) totalByPlotClass.set(key, { plot: row.plot, dbh_lower: row.dbh_lower, TPA: 0, BA_ac: 0 });
      const group = totalByPlotClass.get(key);
      group.TPA += finiteOrZero(row.TPA);
      group.BA_ac += finiteOrZero(row.BA_ac);
    });

    const standTotal = classList.map((dbhLower) => {
      const rows = plots.map((plot) => totalByPlotClass.get(joinKey(plot, dbhLower)) || { plot, dbh_lower: dbhLower, TPA: 0, BA_ac: 0 });
      return {
        group: "Total",
        dbh_lower: dbhLower,
        ...metricSet(rows, "TPA", "TPA", plots.length),
        ...metricSet(rows, "BA_ac", "BA_ac", plots.length),
        n_plots: plots.length
      };
    });

    return {
      standTable: standTable.sort((a, b) => compareMixed(a.spp, b.spp) || numericSort(a.dbh_lower, b.dbh_lower)),
      standTotal: standTotal.sort((a, b) => numericSort(a.dbh_lower, b.dbh_lower))
    };
  }

  function metricSet(rows, sourceField, prefix, nPlots) {
    const values = rows.map((row) => finiteOrZero(row[sourceField]));
    const meanValue = mean(values);
    const sdValue = sampleSd(values);
    return {
      [`${prefix}_mean`]: meanValue,
      [`${prefix}_sd`]: sdValue,
      [`${prefix}_se`]: Number.isFinite(sdValue) ? sdValue / Math.sqrt(nPlots) : NaN,
      [`${prefix}_cv`]: meanValue > 0 && Number.isFinite(sdValue) ? 100 * sdValue / meanValue : NaN
    };
  }

  function renderResults(result) {
    const total = result.totalSummary[0];
    const droppedCount = result.audit.nsvbDropped.length + result.audit.baseDropped.length + result.audit.statusDropped.length;
    els.summaryCards.innerHTML = "";
    [
      ["Records kept", result.dat1.length],
      ["Plots", result.nPlots],
      ["Species", result.species.length],
      ["Stand Total", total.VOB_Sound_mean, "ft3/ac sound"],
      ["BA/ac", total.BA_ac_mean],
      ["TPA", total.TPA_mean]
    ].forEach(([label, value, note]) => {
      const card = document.createElement("div");
      card.className = "metric-card";
      card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${formatValue(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}`;
      els.summaryCards.appendChild(card);
    });

    renderOverviewDetail(result);
    renderBarChart(els.speciesTpaChart, "Species Trees per Acre", result.speciesSummary, "spp", "TPA_mean", "TPA");
    renderBarChart(els.speciesBaChart, "Species Basal Area per Acre", result.speciesSummary, "spp", "BA_ac_mean", "BA/ac");
    renderBarChart(els.dbhTpaChart, "Trees per Acre by DBH Class", result.standTotal, "dbh_lower", "TPA_mean", "TPA", (row) => `${row.dbh_lower}`, (a, b) => numericSort(a.dbh_lower, b.dbh_lower));
    renderBarChart(els.dbhBaChart, "Basal Area per Acre by DBH Class", result.standTotal, "dbh_lower", "BA_ac_mean", "BA/ac", (row) => `${row.dbh_lower}`, (a, b) => numericSort(a.dbh_lower, b.dbh_lower));

    renderTable(els.stockTable, result.stockTable, [
      "group", "BA_ac_mean", "BA_ac_se", "BA_ac_cv",
      "TPA_mean", "TPA_se", "TPA_cv",
      "VOB_Gross_mean", "VOB_Gross_se",
      "VOB_Sound_mean", "VOB_Sound_se",
      "n_plots"
    ]);
    renderTable(els.standTable, result.standTotal, [
      "group", "dbh_lower", "TPA_mean", "TPA_se", "TPA_cv",
      "BA_ac_mean", "BA_ac_se", "BA_ac_cv", "n_plots"
    ]);
    renderTable(els.crownRatioTable, result.crownRatioSummary, [
      "spp", "crown_ratio_mean", "total_yi", "total_mi"
    ]);
    renderAudit(result, droppedCount);
  }

  function renderOverviewDetail(result) {
    const total = result.totalSummary[0];
    const values = [
      ["Outside Bark Sound", total.VOB_Sound_mean, "ft3/ac"],
      ["Outside Bark Gross", total.VOB_Gross_mean, "ft3/ac"],
      ["Inside Bark Sound", total.VIB_Sound_mean, "ft3/ac"],
      ["Inside Bark Gross", total.VIB_Gross_mean, "ft3/ac"],
      ["Basal Area", total.BA_ac_mean, "ft2/ac"],
      ["Trees Per Acre", total.TPA_mean, "trees/ac"]
    ];
    els.overviewDetail.innerHTML = values.map(([label, value, unit]) => `
      <div class="overview-card">
        <span>${escapeHtml(label)}</span>
        <strong>${formatValue(value)}</strong>
        <small>${escapeHtml(unit)}</small>
      </div>
    `).join("");
  }

  function renderBarChart(container, title, rows, labelKey, valueKey, unit, labelFn, sortFn) {
    container.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = title;
    container.appendChild(heading);

    const positiveRows = rows
      .filter((row) => finiteOrZero(row[valueKey]) > 0)
      .sort(sortFn || ((a, b) => finiteOrZero(b[valueKey]) - finiteOrZero(a[valueKey])));

    if (!positiveRows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No positive values to chart.";
      container.appendChild(empty);
      return;
    }

    const max = Math.max.apply(null, positiveRows.map((row) => finiteOrZero(row[valueKey])));
    const list = document.createElement("div");
    list.className = "bar-list";
    positiveRows.forEach((row, index) => {
      const value = finiteOrZero(row[valueKey]);
      const label = labelFn ? labelFn(row) : row[labelKey];
      const bar = document.createElement("div");
      bar.className = "bar-row";
      bar.innerHTML = `
        <div class="bar-label" title="${escapeHtml(String(label))}">${escapeHtml(String(label))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${max > 0 ? (value / max) * 100 : 0}%; background:${COLORS[index % COLORS.length]}"></div></div>
        <div class="bar-value">${formatValue(value)} ${escapeHtml(unit)}</div>
      `;
      list.appendChild(bar);
    });
    container.appendChild(list);
  }

  function renderRegenResults(result) {
    const overall = result.overallMeanTpa[0] || {};
    els.regenSummaryCards.innerHTML = "";
    [
      ["Regen records", result.measuredRows.length],
      ["Plots", result.plotList.length],
      ["Null plots", result.nullPlotCount],
      ["Mean TPA", overall.mean_tpa, "regen/ac"]
    ].forEach(([label, value, note]) => {
      const card = document.createElement("div");
      card.className = "metric-card";
      card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${formatValue(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}`;
      els.regenSummaryCards.appendChild(card);
    });

    renderBarChart(els.regenSpeciesChart, "Mean TPA by Species", result.speciesMeanTpa, "species", "mean_tpa", "TPA");
    renderStackedRegenChart(els.regenHeightChart, result);
    renderTable(els.regenOverallTable, result.overallMeanTpa, ["mean_tpa", "n_plots"]);
    renderTable(els.regenSpeciesTable, result.speciesMeanTpa, ["species", "mean_tpa", "n_plots"]);
    renderTable(els.regenHeightTable, result.speciesHeightMeanTpa, ["species", "height_class", "mean_tpa"]);
    renderRegenAudit(result);
    activateRegenGraph("regenSpeciesGraph");
  }

  function renderStackedRegenChart(container, result) {
    container.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = "Mean TPA by Species and Height Class";
    container.appendChild(heading);

    const rows = regenStackedRows(result);
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No positive values to chart.";
      container.appendChild(empty);
      return;
    }

    const legend = document.createElement("div");
    legend.className = "chart-legend";
    result.heightClasses.forEach((heightClass, index) => {
      legend.innerHTML += `<span class="legend-item"><span class="legend-swatch" style="background:${escapeHtml(heightColor(index))}"></span>${escapeHtml(heightClass)}</span>`;
    });
    container.appendChild(legend);

    const max = Math.max.apply(null, rows.map((row) => row.total));
    const list = document.createElement("div");
    list.className = "stacked-list";
    rows.forEach((row) => {
      const bar = document.createElement("div");
      bar.className = "stacked-row";
      const segments = row.segments
        .filter((segment) => segment.value > 0)
        .map((segment, index) => {
          const width = row.total > 0 ? (segment.value / row.total) * 100 : 0;
          return `<div class="stacked-segment" title="${escapeHtml(segment.label)}: ${formatValue(segment.value)} TPA" style="width:${width}%; background:${escapeHtml(segment.color || COLORS[index % COLORS.length])}"></div>`;
        })
        .join("");
      bar.innerHTML = `
        <div class="bar-label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</div>
        <div class="stacked-track" style="max-width:${max > 0 ? (row.total / max) * 100 : 0}%">${segments}</div>
        <div class="bar-value">${formatValue(row.total)} TPA</div>
      `;
      list.appendChild(bar);
    });
    container.appendChild(list);
  }

  function regenStackedRows(result) {
    const byKey = new Map(result.speciesHeightMeanTpa.map((row) => [joinKey(row.species, row.height_class), finiteOrZero(row.mean_tpa)]));
    return result.speciesMeanTpa
      .map((row) => {
        const segments = result.heightClasses.map((heightClass, index) => ({
          label: heightClass,
          value: byKey.get(joinKey(row.species, heightClass)) || 0,
          color: heightColor(index)
        }));
        const total = segments.reduce((sum, segment) => sum + segment.value, 0);
        return { label: row.species, total, speciesMean: finiteOrZero(row.mean_tpa), segments };
      })
      .filter((row) => row.total > 0 || row.speciesMean > 0)
      .sort((a, b) => b.speciesMean - a.speciesMean);
  }

  function heightColor(index) {
    return TINY_HEIGHT_COLORS[index] || COLORS[index % COLORS.length];
  }

  function renderRegenAudit(result) {
    els.regenAuditReport.innerHTML = "";
    addRegenAuditBlock("Regen run settings", [
      `CSV file: ${result.fileName || "Uploaded regen file"}`,
      `Expansion factor: ${result.expansionFactor}`,
      `Raw records: ${state.regen.rows.length}`,
      `Measured regen records: ${result.measuredRows.length}`,
      `Plots in denominator: ${result.plotList.length}`,
      `Null plots detected: ${result.nullPlotCount}${result.nullPlots.length ? " (" + result.nullPlots.join(", ") + ")" : ""}`
    ]);
    addRegenAuditBlock("Dropped regen rows", [
      `Missing plot, species, or stem count: ${result.droppedRows.length}`
    ]);
    if (result.droppedRows.length) {
      addRegenAuditBlock("Dropped row preview", result.droppedRows.slice(0, 30).map((row) => {
        return `CSV row ${row.row}: plot ${blankToText(row.plot)}, species ${blankToText(row.species)}, stems ${blankToText(row.stems)} - ${row.reason}`;
      }));
    }
  }

  function addRegenAuditBlock(title, items) {
    const block = document.createElement("section");
    block.className = "audit-block";
    block.innerHTML = `<h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    els.regenAuditReport.appendChild(block);
  }

  function renderTable(container, rows, columns, limit) {
    container.innerHTML = "";
    if (!rows || !rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No table rows available.";
      container.appendChild(empty);
      return;
    }

    const shown = rows.slice(0, limit || 500);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    thead.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
    shown.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = columns.map((column) => {
        const value = row[column];
        const numeric = typeof value === "number";
        return `<td class="${numeric ? "numeric" : ""}">${escapeHtml(formatCell(value))}</td>`;
      }).join("");
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function renderAudit(result, droppedCount) {
    const audit = result.audit;
    els.auditReport.innerHTML = "";

    addAuditBlock("Run settings", [
      `CSV file: ${audit.fileName || "Uploaded file"}`,
      `Eco region: ${audit.params.eco.type} ${audit.params.eco.code} (Division ${audit.params.eco.division})`,
      `BAF: ${audit.params.baf}`,
      `DBH class width: ${audit.params.dbhClassWidth}`,
      `Raw records: ${audit.rawCount}`,
      `Records kept: ${result.dat1.length}`,
      `Records dropped: ${droppedCount}`,
      `Null plots detected: ${audit.nullPlotCount || 0}${audit.nullPlots && audit.nullPlots.length ? " (" + audit.nullPlots.join(", ") + ")" : ""}`
    ]);

    addAuditBlock("Pre-checks", [
      `Missing or blank status values: ${audit.precheck.missingStatus}`,
      `Missing or invalid DBH values: ${audit.precheck.missingDbh}`,
      `Missing height values: ${audit.precheck.missingHeight}`,
      `Missing species codes: ${audit.precheck.missingSpecies}`
    ]);

    addAuditBlock("Dropped records", [
      `NSVB coefficient lookup: ${audit.nsvbDropped.length}`,
      `Base plot/species/DBH filter: ${audit.baseDropped.length}`,
      `Live/dead status filter: ${audit.statusDropped.length}`
    ]);

    if (audit.deadDecay) {
      addAuditBlock("Dead tree DECAYCD sound-volume handling", [
        `Dead tree records: ${audit.deadDecay.dead_tree_records}`,
        `Missing DECAYCD: ${audit.deadDecay.missing_DECAYCD}`,
        `DECAYCD used for sound volume: ${audit.deadDecay.DECAYCD_used_for_sound}`,
        `Dead trees with field CULL: ${audit.deadDecay.dead_trees_with_field_CULL}`
      ]);
    }

    const preview = audit.nsvbDropped.concat(audit.baseDropped, audit.statusDropped).slice(0, 30);
    if (preview.length) {
      addAuditBlock("Dropped record preview", preview.map((row) => {
        return `Plot ${blankToText(row.plot)}, SPCD ${blankToText(row.SPCD)}, DBH ${blankToText(row.DIA || row.dbh)}: ${row.reason}`;
      }));
    }
    if (audit.nullPlots && audit.nullPlots.length) {
      addAuditBlock("Null plot denominator check", audit.nullPlots.map((plot) => {
        return `Plot ${plot} was included in plot-count denominators with zero tree records.`;
      }));
    }
  }

  function addAuditBlock(title, items) {
    const block = document.createElement("section");
    block.className = "audit-block";
    block.innerHTML = `<h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    els.auditReport.appendChild(block);
  }

  function renderEmptyResults() {
    if (els.overviewDetail) {
      els.overviewDetail.innerHTML = `<div class="empty-state">Results will appear after a CSV is processed.</div>`;
    }
    ["speciesTpaChart", "speciesBaChart", "dbhTpaChart", "dbhBaChart"].forEach((id) => {
      const box = els[id];
      if (!box) return;
      box.innerHTML = `<div class="empty-state">Results will appear after a CSV is processed.</div>`;
    });
    els.stockTable.innerHTML = `<div class="empty-state">No stock table yet.</div>`;
    els.standTable.innerHTML = `<div class="empty-state">No stand table yet.</div>`;
    els.crownRatioTable.innerHTML = `<div class="empty-state">No crown ratio averages yet.</div>`;
    els.auditReport.innerHTML = `<div class="empty-state">No audit report yet.</div>`;
  }

  function renderEmptyRegen() {
    if (!els.regenSummaryCards) return;
    els.regenSummaryCards.innerHTML = "";
    ["regenSpeciesChart", "regenHeightChart"].forEach((id) => {
      const box = els[id];
      if (!box) return;
      box.innerHTML = `<div class="empty-state">Regen results will appear after a CSV is processed.</div>`;
    });
    els.regenOverallTable.innerHTML = `<div class="empty-state">No overall regen table yet.</div>`;
    els.regenSpeciesTable.innerHTML = `<div class="empty-state">No species regen table yet.</div>`;
    els.regenHeightTable.innerHTML = `<div class="empty-state">No species x height regen table yet.</div>`;
    els.regenAuditReport.innerHTML = `<div class="empty-state">No regen audit report yet.</div>`;
  }

  function clearResults() {
    state.result = null;
    els.summaryCards.innerHTML = "";
    renderEmptyResults();
    enableDownloads(false);
  }

  function enableDownloads(enabled) {
    [els.downloadAllBtn, els.stockCsvBtn, els.standCsvBtn, els.crownRatioCsvBtn, els.auditTxtBtn].forEach((button) => {
      button.disabled = !enabled;
    });
  }

  function resetApp() {
    state.headers = [];
    state.rows = [];
    state.fileName = "";
    state.result = null;
    els.csvFile.value = "";
    els.fileStatus.textContent = "Choose a .csv file";
    els.baf.value = "20";
    els.dbhClassWidth.value = "2";
    document.querySelector("input[name='ecoRegionType'][value='PROVINCE']").checked = true;
    populateEcoRegionCodes();
    populateColumnSelects([]);
    renderEmptyResults();
    els.summaryCards.innerHTML = "";
    state.regen.result = null;
    renderEmptyRegen();
    updateRegenRunButton();
    enableDownloads(false);
    updateRunButton();
    setBanner("", "Ready", "Upload a cruise CSV to begin.");
  }

  window.PlotWeaselApp = {
    loadCsvText(text, fileName) {
      const parsed = loadCsvTextIntoState(text, fileName);
      return { headers: parsed.headers, rowCount: parsed.rows.length, runEnabled: !els.runBtn.disabled };
    },
    runCurrent() {
      const params = readParams();
      const result = runPlotWeasel(state.rows, params);
      state.result = result;
      renderResults(result);
      enableDownloads(true);
      setBanner("success", "Calculation complete", `${result.dat1.length.toLocaleString()} live/dead records processed across ${result.nPlots.toLocaleString()} plots.`);
      return this.summary();
    },
    summary() {
      if (!state.result) return null;
      const total = state.result.totalSummary[0];
      return {
        recordsKept: state.result.dat1.length,
        plots: state.result.nPlots,
        species: state.result.species.length,
        standTotalVolume: total.VOB_Sound_mean,
        baPerAcre: total.BA_ac_mean,
        tpa: total.TPA_mean
      };
    },
    loadRegenCsvText(text, fileName) {
      const parsed = loadRegenTextIntoState(text, fileName);
      return { headers: parsed.headers, rowCount: parsed.rows.length, runEnabled: !els.regenRunBtn.disabled };
    },
    runRegen() {
      runRegenFromState();
      return this.regenSummary();
    },
    regenSummary() {
      if (!state.regen.result) return null;
      const result = state.regen.result;
      return {
        recordsKept: result.measuredRows.length,
        plots: result.plotList.length,
        nullPlots: result.nullPlotCount,
        species: result.speciesMeanTpa.length,
        meanTpa: result.overallMeanTpa[0] ? result.overallMeanTpa[0].mean_tpa : null
      };
    }
  };

  function setBanner(type, title, message) {
    els.statusBanner.className = `status-banner ${type || ""}`.trim();
    els.statusBanner.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  }

  function activateTab(tabName) {
    document.querySelectorAll(".tab[data-tab]").forEach((button) => {
      const active = button.dataset.tab === tabName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const active = panel.id === tabName;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function activateGraph(graphName) {
    document.querySelectorAll(".graph-tab[data-graph]").forEach((button) => {
      const active = button.dataset.graph === graphName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("#graphs .graph-panel").forEach((panel) => {
      const active = panel.id === graphName;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function activateRegenGraph(graphName) {
    document.querySelectorAll(".graph-tab[data-regen-graph]").forEach((button) => {
      const active = button.dataset.regenGraph === graphName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("#regen .graph-panel").forEach((panel) => {
      const active = panel.id === graphName;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function buildOutputFiles(result) {
    return [
      {
        name: "species_ba_tpa_volume_gross_sound.csv",
        content: toCsv(result.speciesSummary, [
          "spp", "BA_ac_mean", "TPA_mean",
          "VIB_Gross_mean", "VOB_Gross_mean",
          "VIB_Sound_mean", "VOB_Sound_mean"
        ])
      },
      {
        name: "stand_totals_ba_tpa_volume_gross_sound.csv",
        content: toCsv(result.totalSummary, [
          "group", "BA_ac_mean", "BA_ac_se", "BA_ac_cv",
          "TPA_mean", "TPA_se", "TPA_cv",
          "VIB_Gross_mean", "VIB_Gross_se", "VIB_Gross_cv",
          "VOB_Gross_mean", "VOB_Gross_se", "VOB_Gross_cv",
          "VIB_Sound_mean", "VIB_Sound_se", "VIB_Sound_cv",
          "VOB_Sound_mean", "VOB_Sound_se", "VOB_Sound_cv",
          "n_plots"
        ])
      },
      {
        name: "combined_stock_table_gross_sound.csv",
        content: toCsv(result.stockTable, [
          "group", "BA_ac_mean", "BA_ac_se", "BA_ac_cv",
          "TPA_mean", "TPA_se", "TPA_cv",
          "VIB_Gross_mean", "VIB_Gross_se", "VIB_Gross_cv",
          "VOB_Gross_mean", "VOB_Gross_se", "VOB_Gross_cv",
          "VIB_Sound_mean", "VIB_Sound_se", "VIB_Sound_cv",
          "VOB_Sound_mean", "VOB_Sound_se", "VOB_Sound_cv",
          "n_plots"
        ])
      },
      {
        name: "species_crown_ratio_summary.csv",
        content: toCsv(result.crownRatioSummary, [
          "spp", "crown_ratio_mean", "total_yi", "total_mi"
        ])
      },
      {
        name: "dead_tree_decay_sound_audit.csv",
        content: toCsv([result.audit.deadDecay], [
          "dead_tree_records", "missing_DECAYCD", "DECAYCD_used_for_sound", "dead_trees_with_field_CULL"
        ])
      },
      {
        name: "status_ba_tpa_live_dead_summary.csv",
        content: toCsv(result.statusSummary, [
          "status", "BA_ac_mean", "BA_ac_sd", "BA_ac_se", "BA_ac_cv",
          "TPA_mean", "TPA_sd", "TPA_se", "TPA_cv", "n_plots"
        ])
      },
      {
        name: "species_status_ba_tpa_live_dead_summary.csv",
        content: toCsv(result.speciesStatusSummary, [
          "spp", "status", "BA_ac_mean", "BA_ac_sd", "BA_ac_se", "BA_ac_cv",
          "TPA_mean", "TPA_sd", "TPA_se", "TPA_cv", "n_plots"
        ])
      },
      {
        name: "stand_table_by_species_dbh.csv",
        content: toCsv(result.standTable, [
          "spp", "dbh_lower", "TPA_mean", "TPA_se", "TPA_cv",
          "BA_ac_mean", "BA_ac_se", "BA_ac_cv", "n_plots"
        ])
      },
      {
        name: "stand_totals_by_dbh.csv",
        content: toCsv(result.standTotal, [
          "group", "dbh_lower", "TPA_mean", "TPA_se", "TPA_cv",
          "BA_ac_mean", "BA_ac_se", "BA_ac_cv", "n_plots"
        ])
      },
      {
        name: "per_tree_volumes.csv",
        content: toCsv(result.perTreeVolumes, [
          "plot", "spp", "SPCD", "DIA", "HT", "ACTUALHT", "CULL", "DECAYCD",
          "DECAY_CULL_PCT", "SOUND_CULL_PCT", "SOUND_HEIGHT_FACTOR", "statusRaw", "status",
          "V_tot_ib_Gross", "V_tot_bk_Gross", "V_tot_ob_Gross",
          "V_tot_ib_Sound", "V_tot_bk_Sound", "V_tot_ob_Sound"
        ])
      },
      {
        name: "graphs/species_tpa.svg",
        content: barChartSvg("Species Trees per Acre", result.speciesSummary, "spp", "TPA_mean", "TPA")
      },
      {
        name: "graphs/species_ba.svg",
        content: barChartSvg("Species Basal Area per Acre", result.speciesSummary, "spp", "BA_ac_mean", "BA/ac")
      },
      {
        name: "graphs/dbh_tpa.svg",
        content: barChartSvg("Trees per Acre by DBH Class", result.standTotal, "dbh_lower", "TPA_mean", "TPA", (row) => `${row.dbh_lower}`, (a, b) => numericSort(a.dbh_lower, b.dbh_lower))
      },
      {
        name: "graphs/dbh_ba.svg",
        content: barChartSvg("Basal Area per Acre by DBH Class", result.standTotal, "dbh_lower", "BA_ac_mean", "BA/ac", (row) => `${row.dbh_lower}`, (a, b) => numericSort(a.dbh_lower, b.dbh_lower))
      },
      {
        name: "data_audit.txt",
        content: auditText(result)
      }
    ];
  }

  function buildTinyOutputFiles(result) {
    return [
      {
        name: "overall_mean_tpa.csv",
        content: toCsv(result.overallMeanTpa, ["mean_tpa", "n_plots"])
      },
      {
        name: "mean_tpa_by_species.csv",
        content: toCsv(result.speciesMeanTpa, ["species", "mean_tpa", "n_plots"])
      },
      {
        name: "mean_tpa_by_species_height.csv",
        content: toCsv(result.speciesHeightMeanTpa, ["species", "height_class", "mean_tpa"])
      },
      {
        name: "tpa_by_plot.csv",
        content: toCsv(result.tpaByPlot, ["plot", "tpa_plot"])
      },
      {
        name: "graphs/mean_tpa_by_species_bar.svg",
        content: barChartSvg("Mean TPA by Species", result.speciesMeanTpa, "species", "mean_tpa", "TPA")
      },
      {
        name: "graphs/mean_tpa_by_species_height_stacked.svg",
        content: stackedRegenSvg(result)
      },
      {
        name: "regen_audit.txt",
        content: regenAuditText(result)
      }
    ];
  }

  function barChartSvg(title, rows, labelKey, valueKey, unit, labelFn, sortFn) {
    const chartRows = rows
      .filter((row) => finiteOrZero(row[valueKey]) > 0)
      .sort(sortFn || ((a, b) => finiteOrZero(b[valueKey]) - finiteOrZero(a[valueKey])));
    const width = 1100;
    const labelWidth = 250;
    const valueWidth = 135;
    const barHeight = 18;
    const gap = 12;
    const top = 64;
    const rowHeight = barHeight + gap;
    const height = Math.max(220, top + chartRows.length * rowHeight + 34);
    const barWidth = width - labelWidth - valueWidth - 74;
    const max = Math.max.apply(null, chartRows.map((row) => finiteOrZero(row[valueKey])).concat([1]));
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
      `<text x="28" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#153f36">${escapeXml(title)}</text>`
    ];
    if (!chartRows.length) {
      parts.push(`<text x="28" y="92" font-family="Arial, sans-serif" font-size="16" fill="#5c6864">No positive values to chart.</text>`);
    }
    chartRows.forEach((row, index) => {
      const value = finiteOrZero(row[valueKey]);
      const label = labelFn ? labelFn(row) : row[labelKey];
      const y = top + index * rowHeight;
      const fillWidth = max > 0 ? (value / max) * barWidth : 0;
      parts.push(`<text x="28" y="${y + 15}" font-family="Arial, sans-serif" font-size="13" fill="#26322f">${escapeXml(String(label))}</text>`);
      parts.push(`<rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#e8eee9"/>`);
      parts.push(`<rect x="${labelWidth}" y="${y}" width="${fillWidth}" height="${barHeight}" rx="4" fill="${escapeXml(COLORS[index % COLORS.length])}"/>`);
      parts.push(`<text x="${labelWidth + barWidth + 16}" y="${y + 15}" font-family="Arial, sans-serif" font-size="13" fill="#26322f">${escapeXml(formatValue(value) + " " + unit)}</text>`);
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function stackedRegenSvg(result) {
    const rows = regenStackedRows(result);
    const width = 1100;
    const labelWidth = 250;
    const valueWidth = 135;
    const barHeight = 18;
    const gap = 12;
    const legendTop = 52;
    const top = 92;
    const rowHeight = barHeight + gap;
    const height = Math.max(240, top + rows.length * rowHeight + 34);
    const barWidth = width - labelWidth - valueWidth - 74;
    const max = Math.max.apply(null, rows.map((row) => row.total).concat([1]));
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
      `<text x="28" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#153f36">Mean TPA by Species and Height Class</text>`
    ];
    result.heightClasses.forEach((heightClass, index) => {
      const x = 28 + index * 145;
      parts.push(`<rect x="${x}" y="${legendTop}" width="14" height="14" rx="3" fill="${escapeXml(heightColor(index))}"/>`);
      parts.push(`<text x="${x + 20}" y="${legendTop + 12}" font-family="Arial, sans-serif" font-size="12" fill="#5c6864">${escapeXml(heightClass)}</text>`);
    });
    if (!rows.length) {
      parts.push(`<text x="28" y="120" font-family="Arial, sans-serif" font-size="16" fill="#5c6864">No positive values to chart.</text>`);
    }
    rows.forEach((row, index) => {
      const y = top + index * rowHeight;
      const totalWidth = max > 0 ? (row.total / max) * barWidth : 0;
      let x = labelWidth;
      parts.push(`<text x="28" y="${y + 15}" font-family="Arial, sans-serif" font-size="13" fill="#26322f">${escapeXml(row.label)}</text>`);
      parts.push(`<rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#e8eee9"/>`);
      row.segments.filter((segment) => segment.value > 0).forEach((segment) => {
        const segmentWidth = row.total > 0 ? (segment.value / row.total) * totalWidth : 0;
        parts.push(`<rect x="${x}" y="${y}" width="${segmentWidth}" height="${barHeight}" fill="${escapeXml(segment.color)}"/>`);
        x += segmentWidth;
      });
      parts.push(`<text x="${labelWidth + barWidth + 16}" y="${y + 15}" font-family="Arial, sans-serif" font-size="13" fill="#26322f">${escapeXml(formatValue(row.total) + " TPA")}</text>`);
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function regenAuditText(result) {
    const lines = [
      "Tiny Weasel Regen Data Audit",
      "",
      `CSV file: ${result.fileName || "Uploaded regen file"}`,
      `Expansion factor: ${result.expansionFactor}`,
      `Raw records: ${state.regen.rows.length}`,
      `Measured regen records: ${result.measuredRows.length}`,
      `Plots in denominator: ${result.plotList.length}`,
      `Null plots detected: ${result.nullPlotCount}${result.nullPlots.length ? " (" + result.nullPlots.join(", ") + ")" : ""}`,
      "",
      "Dropped regen rows",
      `Missing plot, species, or stem count: ${result.droppedRows.length}`
    ];
    if (result.droppedRows.length) {
      lines.push("", "Dropped row preview");
      result.droppedRows.slice(0, 200).forEach((row) => {
        lines.push(`CSV row ${row.row}: plot ${blankToText(row.plot)}, species ${blankToText(row.species)}, stems ${blankToText(row.stems)} - ${row.reason}`);
      });
    }
    return lines.join("\r\n") + "\r\n";
  }

  function downloadNamedOutput(name) {
    if (!state.result) return;
    const file = buildOutputFiles(state.result).find((item) => item.name === name);
    if (!file) return;
    downloadBlob(new Blob([file.content], { type: name.endsWith(".csv") ? "text/csv" : "text/plain" }), name);
  }

  function auditText(result) {
    const audit = result.audit;
    const droppedCount = audit.nsvbDropped.length + audit.baseDropped.length + audit.statusDropped.length;
    const lines = [
      "Plot Weasel Desktop Data Audit",
      "",
      `CSV file: ${audit.fileName || "Uploaded file"}`,
      `Eco region: ${audit.params.eco.type} ${audit.params.eco.code}`,
      `Mapped division: ${audit.params.eco.division}`,
      `Mapped province: ${audit.params.eco.province || ""}`,
      `BAF: ${audit.params.baf}`,
      `DBH class width: ${audit.params.dbhClassWidth}`,
      "",
      `Raw records: ${audit.rawCount}`,
      `Records kept: ${result.dat1.length}`,
      `Records dropped: ${droppedCount}`,
      `Null plots detected: ${audit.nullPlotCount || 0}${audit.nullPlots && audit.nullPlots.length ? " (" + audit.nullPlots.join(", ") + ")" : ""}`,
      "",
      "Pre-checks",
      `Missing or blank status values: ${audit.precheck.missingStatus}`,
      `Missing or invalid DBH values: ${audit.precheck.missingDbh}`,
      `Missing height values: ${audit.precheck.missingHeight}`,
      `Missing species codes: ${audit.precheck.missingSpecies}`,
      "",
      "Dropped records",
      `NSVB coefficient lookup: ${audit.nsvbDropped.length}`,
      `Base plot/species/DBH filter: ${audit.baseDropped.length}`,
      `Live/dead status filter: ${audit.statusDropped.length}`,
      "",
      "Dead tree DECAYCD sound-volume handling",
      `Dead tree records: ${audit.deadDecay ? audit.deadDecay.dead_tree_records : 0}`,
      `Missing DECAYCD: ${audit.deadDecay ? audit.deadDecay.missing_DECAYCD : 0}`,
      `DECAYCD used for sound volume: ${audit.deadDecay ? audit.deadDecay.DECAYCD_used_for_sound : 0}`,
      `Dead trees with field CULL: ${audit.deadDecay ? audit.deadDecay.dead_trees_with_field_CULL : 0}`
    ];

    const dropped = audit.nsvbDropped.concat(audit.baseDropped, audit.statusDropped);
    if (dropped.length) {
      lines.push("", "Dropped record preview");
      dropped.slice(0, 200).forEach((row) => {
        lines.push(`Plot ${blankToText(row.plot)}, SPCD ${blankToText(row.SPCD)}, DBH ${blankToText(row.DIA || row.dbh)}: ${row.reason}`);
      });
    }
    return lines.join("\r\n") + "\r\n";
  }

  function downloadTemplate() {
    const text = [
      "plot,spp,dbh,ht,actualht,cull,DECAYCD,status",
      "1,202,12.4,78,78,0,,live",
      "1,122,9.1,64,64,5,,live",
      "2,202,15.8,88,82,0,3,dead"
    ].join("\r\n") + "\r\n";
    downloadBlob(new Blob([text], { type: "text/csv" }), "PlotWeasel_CSV_template.csv");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        row.push(field);
        field = "";
        if (row.some((value) => clean(value) !== "")) rows.push(row);
        row = [];
        if (ch === "\r" && text[i + 1] === "\n") i += 1;
      } else {
        field += ch;
      }
    }
    row.push(field);
    if (row.some((value) => clean(value) !== "")) rows.push(row);
    if (!rows.length) return { headers: [], rows: [] };

    const headers = rows.shift().map((header, index) => clean(header).replace(/^\uFEFF/, "") || `Column ${index + 1}`);
    const objects = rows.map((values) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = values[index] === undefined ? "" : values[index];
      });
      return object;
    });
    return { headers, rows: objects };
  }

  function toCsv(rows, columns) {
    const lines = [columns.map(csvEscape).join(",")];
    rows.forEach((row) => {
      lines.push(columns.map((column) => csvEscape(formatCsvValue(row[column]))).join(","));
    });
    return lines.join("\r\n") + "\r\n";
  }

  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function formatCsvValue(value) {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "";
      return String(Number(value.toPrecision(12)));
    }
    return value == null ? "" : value;
  }

  function makeZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const mod = dosDateTime(new Date());

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = encoder.encode(file.content);
      const crc = crc32(dataBytes);
      const local = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, mod.time, true);
      localView.setUint16(12, mod.date, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      const central = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, mod.time, true);
      centralView.setUint16(14, mod.date, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      central.set(nameBytes, 46);

      localParts.push(local, dataBytes);
      centralParts.push(central);
      offset += local.length + dataBytes.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return new Blob(localParts.concat(centralParts, [end]), { type: "application/zip" });
  }

  function crc32(bytes) {
    const table = crc32.table || (crc32.table = makeCrcTable());
    let crc = -1;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  function dosDateTime(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, date: dosDate };
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function findColumn(headers, candidates) {
    const normalized = new Map(headers.map((header) => [normalizeName(header), header]));
    for (const candidate of candidates) {
      const match = normalized.get(normalizeName(candidate));
      if (match) return match;
    }
    for (const header of headers) {
      const name = normalizeName(header);
      if (candidates.some((candidate) => name.includes(normalizeName(candidate)))) return header;
    }
    return null;
  }

  function normalizeName(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function toNumber(value) {
    if (value == null || clean(value) === "") return NaN;
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : NaN;
  }

  function normalizeDecayCode(value) {
    const text = clean(value).toLowerCase();
    const mapped = {
      i: 1,
      "class i": 1,
      "decay 1": 1,
      "decay class 1": 1,
      ii: 2,
      "class ii": 2,
      "decay 2": 2,
      "decay class 2": 2,
      iii: 3,
      "class iii": 3,
      "decay 3": 3,
      "decay class 3": 3,
      iv: 4,
      "class iv": 4,
      "decay 4": 4,
      "decay class 4": 4,
      v: 5,
      "class v": 5,
      "decay 5": 5,
      "decay class 5": 5
    };
    const valueFromMap = mapped[text];
    const code = valueFromMap || toNumber(text);
    return Number.isFinite(code) && code >= 1 && code <= 5 ? Math.trunc(code) : NaN;
  }

  function normalizeStatus(value) {
    const text = clean(value).toLowerCase();
    if (["1", "live", "l", "alive", "live tree"].includes(text)) return "live";
    if (["2", "dead", "d", "dead tree", "standing dead"].includes(text)) return "dead";
    return "";
  }

  function finiteOrZero(value) {
    return Number.isFinite(value) ? value : 0;
  }

  function clampPercent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), 100);
  }

  function safeAdd(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) ? a + b : NaN;
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
  }

  function sampleSd(values) {
    if (values.length < 2) return NaN;
    const m = mean(values);
    const variance = values.reduce((sum, value) => sum + Math.pow(value - m, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  function uniqueSorted(values, compare) {
    return Array.from(new Set(values)).sort(compare);
  }

  function compareCodes(a, b) {
    const aText = clean(a);
    const bText = clean(b);
    const aNum = /^\d+$/.test(aText);
    const bNum = /^\d+$/.test(bText);
    if (aNum && bNum) return Number(aText) - Number(bText);
    if (aNum !== bNum) return aNum ? -1 : 1;
    return aText.localeCompare(bText, undefined, { numeric: true });
  }

  function compareMixed(a, b) {
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return clean(a).localeCompare(clean(b), undefined, { numeric: true });
  }

  function numericSort(a, b) {
    return finiteOrZero(a) - finiteOrZero(b);
  }

  function joinKey() {
    return Array.from(arguments).map((value) => clean(value)).join("\u001f");
  }

  function roundForClass(value) {
    return Number(Number(value).toFixed(6));
  }

  function pick(row, fields) {
    const out = {};
    fields.forEach((field) => {
      out[field] = row[field];
    });
    return out;
  }

  function formatValue(value) {
    if (typeof value !== "number") return blankToText(value);
    if (!Number.isFinite(value)) return "NA";
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }

  function formatCell(value) {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "";
      return Number(value.toPrecision(10)).toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return value == null ? "" : String(value);
  }

  function blankToText(value) {
    return value == null || value === "" || (typeof value === "number" && !Number.isFinite(value)) ? "NA" : String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }
})();
