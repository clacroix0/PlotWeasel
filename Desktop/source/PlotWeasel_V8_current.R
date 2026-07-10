#######################################################################
# 
# Plot Weasel
#
# Casey Sigg
#
# BIA - Branch of Forest Inventory and Planning
# Lakewood, CO
#######################################################################

# Plot Weasel calculates stand and stand tables from a point sample
#
#   metrics calculated include: basal area per acre, trees per acre, average crown ratio, and cubic volume per acre
#   metrics are by stand total, species, and live/dead
#   volume equations used are the National Scale Volume Biomass (NSVB) models [Westfall et al. 2023]
#   source code for NSVB is from Matthew Russell (https://github.com/mbrussell/NSVB)

suppressPackageStartupMessages({
  library(tidyverse)   # dplyr, tidyr, readr, purrr, tibble, stringr, ggplot2, forcats
})

###################################
# Feed the Weasel
#
# USER INPUTS (edit these)
###################################

# this program requires downloading the NSVB source code. Here's the link: https://github.com/mbrussell/NSVB/tree/main
# on the github webpage click the green "Code" button and download the zip file
# once the zip has been extracted copy the file path for the "NSVB-main" folder
# now input that file path below for the tables_dir

tables_dir <- "C:/Users/casey.sigg/OneDrive - DOI/Desktop/NSVB Cruiser/NSVB-main/NSVB-main"

# Your point sample data from the field
# (You selected B → using choose your .csv)
cruise_data <- readr::read_csv("Volume_test.csv", show_col_types = FALSE)

# Column names in cruise_data
species_col   <- "spp"               # Species code (FIA SPCD)
dbh_col       <- "dbh"               # Diameter at breast height (inches)
height_col    <- "ht"                # Total height (ft)
actualht_col  <- "actualht"          # Measured/actual total height accounting for broken tops
cull_col      <- "cull"              # Percent cull/defect (0–100)
status_col    <- "status"            # Live/dead status
decay_col     <- "DECAYCD"           # Dead-tree decay class code (1-5); optional but used for dead-tree sound volume
crown_ratio_col  <- "crown_ratio"    # crown ratio percentage

# EcoDivision/EcoProvince inputs
eco_region_type <- "DIVISION"  # "DIVISION" or "PROVINCE"
eco_region_code <- "M242"       # Division/Province code, e.g. "210", "M331"

# How do I know my EcoDivision?
# A map is shown on page 3 of the publication by Westfall. (https://www.fs.usda.gov/sites/default/files/fs_media/fs_document/biomass-modeling-system.pdf)
# If you want the shapefile: https://data.fs.usda.gov/geodata/edw/datasets.php?xmlKeyword=Ecomap

# point sampling parameters
BAF             <- 20          # Basal Area Factor (ft^2/ac per tallied tree)
dbh_class_width <- 2           # inches, DBH bin width for stand tables and plots


###################################
# END of USER INPUTS
###################################


# -----------------------------
# Sanity check: object exists
# -----------------------------
if (!exists("cruise_data")) {
  stop("Object 'cruise_data' not found in the environment.")
}

# ============================================================
# DATA AUDIT (Mode 1: silent unless records are dropped)
# ============================================================
cat("\n=== DATA AUDIT (pre-checks) ================================\n")
raw_n <- nrow(cruise_data)
issues_found <- FALSE

if (!"plot" %in% names(cruise_data)) {
  stop("Column 'plot' is required for per-plot stock/stand summaries.")
}

# FIX NULL PLOTS 1/2:
# Keep the full sampled-plot list from the raw cruise file before tree filters
# and NSVB joins remove blank null-plot rows. This list is the denominator for
# plot-level summaries and includes intentionally blank/null plots.
all_sampled_plots <- cruise_data %>%
  transmute(plot = str_trim(as.character(.data[["plot"]]))) %>%
  filter(!is.na(plot), plot != "") %>%
  distinct(plot) %>%
  pull(plot)

if (length(all_sampled_plots) == 0) {
  stop("No nonblank plot IDs found in cruise_data.")
}

missing_status <- cruise_data %>%
  filter(is.na(.data[[status_col]]) | str_trim(.data[[status_col]]) == "")
if (nrow(missing_status) > 0) { issues_found <- TRUE; cat("• Missing/blank status values: ", nrow(missing_status), "\n") }

missing_dbh <- cruise_data %>%
  filter(is.na(.data[[dbh_col]]) | suppressWarnings(as.numeric(.data[[dbh_col]])) <= 0)
if (nrow(missing_dbh) > 0) { issues_found <- TRUE; cat("• Missing/invalid DBH (<= 0): ", nrow(missing_dbh), "\n") }

missing_ht <- cruise_data %>%
  filter(is.na(.data[[height_col]]))
if (nrow(missing_ht) > 0) { issues_found <- TRUE; cat("• Missing height (ht): ", nrow(missing_ht), "\n") }

missing_spp <- cruise_data %>%
  filter(is.na(.data[[species_col]]))
if (nrow(missing_spp) > 0) { issues_found <- TRUE; cat("• Missing species code (spp): ", nrow(missing_spp), "\n") }

if (!issues_found) cat("• Pre‑checks OK (no obvious input issues)\n")
cat("Raw records in CSV: ", raw_n, "\n")
cat("============================================================\n")

# --- Detect null plots (exactly one row and all other fields blank) ---

# Identify all non-plot columns programmatically
other_cols <- setdiff(names(cruise_data), "plot")

# Filter to plots with exactly one row, then test if all non-plot fields are blank/NA
null_plots <- cruise_data %>%
  group_by(plot) %>%
  filter(n() == 1) %>%
  ungroup() %>%
  mutate(
    # Predicate that treats empty strings as blank and leaves numerics alone
    all_blank = if_all(
      all_of(other_cols),
      ~ is.na(.) | ifelse(is.character(.), . == "", FALSE)
    )
  ) %>%
  filter(all_blank) %>%
  distinct(plot) %>%
  pull(plot)

cat("• Null plots detected: ", length(null_plots), "\n")
if (length(null_plots) > 0) {
  cat("  Null plot IDs: ", paste(null_plots, collapse = ", "), "\n")
}

# ============================================================
# PART A — NSVB VOLUMES
# ============================================================

# NSVB core
get_nsvb <- function(MODEL, SPCD, DIA, HT, a, a1, b, b1, c, c1, WDSG){
  if (MODEL == 1){
    a * DIA^b * HT^c
  } else if (MODEL == 2 & SPCD < 300 & DIA < 9){
    a * DIA^b * HT^c
  } else if (MODEL == 2 & SPCD < 300 & DIA >= 9){
    a * (9^(b - b1)) * DIA^b1 * HT^c
  } else if (MODEL == 2 & SPCD >= 300 & DIA < 11){
    a * DIA^b * HT^c
  } else if (MODEL == 2 & SPCD >= 300 & DIA >= 11){
    a * (11^(b - b1)) * DIA^b1 * HT^c
  } else if (MODEL == 3){
    a * DIA^(a1 * (1 - exp(-1 * b * DIA)))^c1 * HT^c
  } else if (MODEL == 4){
    a * DIA^b * HT^c * exp(-1 * (b1 * DIA))
  } else if (MODEL == 5){
    a * DIA^b * HT^c * WDSG
  } else {
    NA_real_
  }
}

# DECAYCD handling for standing dead trees.
#
# NSVB distinguishes gross and sound volume outputs. This script calculates sound
# volume from gross volume using field cull/defect. DECAYCD is used as a
# dead-tree cull fallback when CULL is blank or zero, so decay-class data are not
# silently ignored for standing dead trees.
#
# The script keeps field-entered CULL when it is greater than zero.
dead_decay_cull_lookup <- tibble::tibble(
  DECAYCD = 1:5,
  DECAY_CULL_PCT = c(0, 10, 30, 50, 70)
)

normalize_decaycd <- function(x) {
  x_chr <- stringr::str_to_lower(stringr::str_trim(as.character(x)))
  x_chr <- dplyr::case_when(
    x_chr %in% c("i", "class i", "decay 1", "decay class 1") ~ "1",
    x_chr %in% c("ii", "class ii", "decay 2", "decay class 2") ~ "2",
    x_chr %in% c("iii", "class iii", "decay 3", "decay class 3") ~ "3",
    x_chr %in% c("iv", "class iv", "decay 4", "decay class 4") ~ "4",
    x_chr %in% c("v", "class v", "decay 5", "decay class 5") ~ "5",
    TRUE ~ x_chr
  )
  suppressWarnings(as.integer(readr::parse_number(x_chr)))
}

normalize_status <- function(x) {
  x_chr <- stringr::str_to_lower(stringr::str_trim(as.character(x)))
  dplyr::case_when(
    x_chr %in% c("1", "live", "l", "alive", "live tree") ~ "live",
    x_chr %in% c("2", "dead", "d", "dead tree", "standing dead") ~ "dead",
    TRUE ~ NA_character_
  )
}

clamp_percent <- function(x) {
  pmin(pmax(as.numeric(x), 0), 100)
}

# Standardize field names in cruise data
tree <- cruise_data %>%
  as_tibble() %>%
  rename(
    SPCD     = !!species_col,
    DIA      = !!dbh_col,
    HT       = !!height_col,
    ACTUALHT = !!actualht_col,
    CULL     = !!cull_col,
    status   = !!status_col
  ) %>%
  mutate(ACTUALHT = dplyr::coalesce(ACTUALHT, HT))  # default to HT if missing

if (decay_col %in% names(tree) && decay_col != "DECAYCD") {
  tree <- tree %>% rename(DECAYCD = all_of(decay_col))
} else if (!"DECAYCD" %in% names(tree)) {
  tree <- tree %>% mutate(DECAYCD = NA_integer_)
}

tree <- tree %>%
  mutate(
    DECAYCD = normalize_decaycd(DECAYCD),
    DECAYCD = ifelse(DECAYCD %in% 1:5, DECAYCD, NA_integer_),
    status = normalize_status(status)
  )

if (!"HT" %in% names(tree)) {
  stop("Column 'height' is required for NSVB volumes.")
}

# EcoRegion mapping — ensure both DIVISION and PROVINCE present on tree
eco_div_prov <- read_csv(file.path(tables_dir, "eco_div_prov.csv"), show_col_types = FALSE) %>%
  rename(DIVISION = eco_division, PROVINCE = eco_province)

if (eco_region_type == "DIVISION") {
  tree <- tree %>% mutate(DIVISION = eco_region_code)
  prov_map <- eco_div_prov %>% filter(DIVISION == eco_region_code) %>% distinct(PROVINCE)
  tree <- tree %>% mutate(PROVINCE = if (nrow(prov_map)>0) prov_map$PROVINCE[1] else NA_character_)
} else if (eco_region_type == "PROVINCE") {
  tree <- tree %>% mutate(PROVINCE = eco_region_code)
  div_map <- eco_div_prov %>% filter(PROVINCE == eco_region_code) %>% distinct(DIVISION)
  if (nrow(div_map) == 0) stop("EcoProvince not found in eco_div_prov.csv")
  tree <- tree %>% mutate(DIVISION = div_map$DIVISION[1])
} else {
  stop('eco_region_type must be "DIVISION" or "PROVINCE"')
}

selected_division <- unique(tree$DIVISION)[1]
selected_province <- unique(tree$PROVINCE)[1]
primary_col <- if (eco_region_type == "PROVINCE") "PROVINCE" else "DIVISION"
selected_code <- if (eco_region_type == "PROVINCE") selected_province else selected_division

# REF_SPECIES with enforced types (contains JENKINS_SPGRPCD and COMMON_NAME)
ref_spp <- read_csv(
  file.path(tables_dir, "REF_SPECIES.csv"),
  show_col_types = FALSE,
  col_types = cols(
    SPCD = col_double(),
    JENKINS_SPGRPCD = col_double(),
    COMMON_NAME = col_character()
  )
) %>%
  select(SPCD, JENKINS_SPGRPCD, COMMON_NAME) %>%
  filter(SPCD <= 999)
# (Workspace has [REF_SPECIES.csv](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BF268E200-2A11-4CBC-8A7C-7A3455FAB6CB%7D&file=REF_SPECIES.csv&action=default&mobileredirect=true&DefaultItemOpen=1&EntityRepresentationId=0e095527-ae21-411c-8c7f-6b517d98a699).)  # [5](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BF268E200-2A11-4CBC-8A7C-7A3455FAB6CB%7D&file=REF_SPECIES.csv&action=default&mobileredirect=true&DefaultItemOpen=1)

# --- Helpers: normalize region column names, select per species with NA fallback ---
normalize_region_cols <- function(df) {
  nm <- names(df)
  if ("division" %in% nm && !"DIVISION" %in% nm) df <- dplyr::rename(df, DIVISION = division)
  if ("eco_division" %in% nm && !"DIVISION" %in% nm) df <- dplyr::rename(df, DIVISION = eco_division)
  if ("province" %in% nm && !"PROVINCE" %in% nm) df <- dplyr::rename(df, PROVINCE = province)
  if ("eco_province" %in% nm && !"PROVINCE" %in% nm) df <- dplyr::rename(df, PROVINCE = eco_province)
  df
}

# Select the best row per species:
# - Prefer a row where PRIMARY region (DIVISION or PROVINCE) == selected code
# - Else fallback to a row where PRIMARY region is NA
# - If PRIMARY column doesn't exist, fallback to rows where any region columns present are NA (national)
# Returns exactly one row per SPCD so we can join by SPCD only.
select_best_per_species <- function(df, primary_col, selected_code) {
  df <- normalize_region_cols(df)
  has_primary <- primary_col %in% names(df)
  region_cols <- intersect(c("DIVISION","PROVINCE"), names(df))
  
  df2 <- if (has_primary) {
    df %>%
      mutate(match_primary = .data[[primary_col]] == selected_code,
             primary_na    = is.na(.data[[primary_col]])) %>%
      filter(match_primary | primary_na) %>%
      mutate(priority = dplyr::case_when(match_primary ~ 2L, primary_na ~ 1L, TRUE ~ 0L))
  } else if (length(region_cols) > 0) {
    # No primary column in table; keep national rows (all region cols NA)
    df %>%
      filter(if_all(all_of(region_cols), ~ is.na(.))) %>%
      mutate(priority = 1L)
  } else {
    # Table has no region columns at all -> treat as national
    df %>% mutate(priority = 1L)
  }
  
  df2 %>%
    arrange(SPCD, dplyr::desc(priority)) %>%
    group_by(SPCD) %>% slice(1) %>% ungroup() %>%
    select(-tidyselect::any_of(c("match_primary","primary_na","priority")))
}

# ============================================================
# 1) Inside-bark gross (S1a/S1b) — select, then JOIN BY SPCD ONLY
# ============================================================
vol_ib_raw_sp <- read_csv(file.path(tables_dir, "Table S1a_volib_coefs_spcd.csv"), show_col_types = FALSE) %>%
  rename(MODEL = model)
# (Workspace has [Table S1a_volib_coefs_spcd.csv](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7B271F026B-50FC-4707-8E63-F20B3E7E6D25%7D&file=Table%20S1a_volib_coefs_spcd.csv&action=default&mobileredirect=true&DefaultItemOpen=1&EntityRepresentationId=ab25717d-8bad-4f69-9595-19dc30118f53).)  # [1](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BC284200F-5F0E-4D4D-8C02-3050140145A6%7D&file=Table%20S2b_volbk_coefs_jenkins.csv&action=default&mobileredirect=true&DefaultItemOpen=1)

vol_ib_sp <- vol_ib_raw_sp %>%
  select_best_per_species(primary_col, selected_code) %>%
  select(SPCD, MODEL, a, a1, b, b1, c, c1)

vol_ib_raw_jk <- read_csv(file.path(tables_dir, "Table S1b_volib_coefs_jenkins.csv"), show_col_types = FALSE) %>%
  rename(MODEL = model)
# (Workspace has [Table S1b_volib_coefs_jenkins.csv](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BFABBE025-EC6C-4121-BA3F-7A07F0840A37%7D&file=Table%20S1b_volib_coefs_jenkins.csv&action=default&mobileredirect=true&DefaultItemOpen=1&EntityRepresentationId=3a91bb97-8546-40b1-b02e-a4c6441f222f).)  # [2](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BFABBE025-EC6C-4121-BA3F-7A07F0840A37%7D&file=Table%20S1b_volib_coefs_jenkins.csv&action=default&mobileredirect=true&DefaultItemOpen=1)

vol_ib_jk <- vol_ib_raw_jk %>%
  inner_join(ref_spp %>% select(SPCD, JENKINS_SPGRPCD), by = "JENKINS_SPGRPCD") %>%
  anti_join(vol_ib_sp %>% distinct(SPCD), by = "SPCD") %>%
  mutate(a1 = NA_real_, b1 = NA_real_, c1 = NA_real_) %>%
  select_best_per_species(primary_col, selected_code) %>%
  select(SPCD, MODEL, a, a1, b, b1, c, c1)

spp_vol_ib <- bind_rows(vol_ib_sp, vol_ib_jk)

tree_before_joins <- tree

# ---- JOIN BY SPCD ONLY (critical to keep NA-region fallbacks) ----
tree <- tree %>%
  inner_join(spp_vol_ib, by = "SPCD") %>%
  rowwise() %>%
  mutate(V_tot_ib_Gross = get_nsvb(MODEL, SPCD, DIA, HT, a, a1, b, b1, c, c1, WDSG = NA_real_)) %>%
  ungroup() %>%
  select(-a, -a1, -b, -b1, -c, -c1, -MODEL)

# ============================================================
# 2) Bark gross (S2a/S2b) — select, then JOIN BY SPCD ONLY
# ============================================================
vol_bk_raw_sp <- read_csv(file.path(tables_dir, "Table S2a_volbk_coefs_spcd.csv"), show_col_types = FALSE) %>%
  rename(MODEL = model)
# (Workspace has [Table S2a_volbk_coefs_spcd.csv](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BAFD19402-8CC6-44D5-8AEC-AA180185D36F%7D&file=Table%20S2a_volbk_coefs_spcd.csv&action=default&mobileredirect=true&DefaultItemOpen=1&EntityRepresentationId=297d4448-7762-4cb7-b01f-a596e929ccc9).)  # [3](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BAFD19402-8CC6-44D5-8AEC-AA180185D36F%7D&file=Table%20S2a_volbk_coefs_spcd.csv&action=default&mobileredirect=true&DefaultItemOpen=1)

vol_bk_sp <- vol_bk_raw_sp %>%
  select_best_per_species(primary_col, selected_code) %>%
  select(SPCD, MODEL, a, a1, b, b1, c, c1)

vol_bk_raw_jk <- read_csv(file.path(tables_dir, "Table S2b_volbk_coefs_jenkins.csv"), show_col_types = FALSE) %>%
  rename(MODEL = model)
# (Workspace has [Table S2b_volbk_coefs_jenkins.csv](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BD823901B-58C3-4BC9-AC1C-DCB426657634%7D&file=Table%20S2b_volbk_coefs_jenkins.csv&action=default&mobileredirect=true&DefaultItemOpen=1&EntityRepresentationId=e53d2c40-2ff5-44a1-9bdc-c0f508724494).)  # [4](https://doimspp-my.sharepoint.com/personal/casey_sigg_indianaffairs_gov/_layouts/15/Doc.aspx?sourcedoc=%7BD823901B-58C3-4BC9-AC1C-DCB426657634%7D&file=Table%20S2b_volbk_coefs_jenkins.csv&action=default&mobileredirect=true&DefaultItemOpen=1)

vol_bk_jk <- vol_bk_raw_jk %>%
  inner_join(ref_spp %>% select(SPCD, JENKINS_SPGRPCD), by = "JENKINS_SPGRPCD") %>%
  anti_join(vol_bk_sp %>% distinct(SPCD), by = "SPCD") %>%
  mutate(a1 = NA_real_, b1 = NA_real_, c1 = NA_real_) %>%
  select_best_per_species(primary_col, selected_code) %>%
  select(SPCD, MODEL, a, a1, b, b1, c, c1)

spp_vol_bk <- bind_rows(vol_bk_sp, vol_bk_jk)

# ---- JOIN BY SPCD ONLY (critical to keep NA-region fallbacks) ----
tree <- tree %>%
  inner_join(spp_vol_bk, by = "SPCD") %>%
  rowwise() %>%
  mutate(V_tot_bk_Gross = get_nsvb(MODEL, SPCD, DIA, HT, a, a1, b, b1, c, c1, WDSG = NA_real_)) %>%
  ungroup() %>%
  select(-a, -a1, -b, -b1, -c, -c1, -MODEL)

# ============================================================
# 3) Outside-bark gross + SOUND
# ============================================================
tree <- tree %>%
  mutate(V_tot_ob_Gross = V_tot_ib_Gross + V_tot_bk_Gross) %>%
  left_join(dead_decay_cull_lookup, by = "DECAYCD") %>%
  mutate(
    status_clean = stringr::str_to_lower(stringr::str_trim(as.character(status))),
    CULL = clamp_percent(readr::parse_number(as.character(CULL))),
    CULL = dplyr::coalesce(CULL, 0),
    DECAY_CULL_PCT = dplyr::coalesce(DECAY_CULL_PCT, 0),
    DECAYCD_USED_FOR_SOUND = status_clean == "dead" & CULL == 0 & DECAY_CULL_PCT > 0,
    SOUND_CULL_PCT = ifelse(DECAYCD_USED_FOR_SOUND, DECAY_CULL_PCT, CULL),
    SOUND_HEIGHT_FACTOR = ifelse(!is.na(ACTUALHT) & !is.na(HT) & HT > 0, ACTUALHT / HT, 1),
    V_tot_ib_Sound_full = V_tot_ib_Gross * (1 - SOUND_CULL_PCT / 100),
    V_tot_bk_Sound_full = V_tot_bk_Gross,  # bark not reduced by CULL
    V_tot_ib_Sound = V_tot_ib_Sound_full * SOUND_HEIGHT_FACTOR,
    V_tot_bk_Sound = V_tot_bk_Sound_full * SOUND_HEIGHT_FACTOR,
    V_tot_ob_Sound = V_tot_ib_Sound + V_tot_bk_Sound
  ) %>%
  select(-status_clean)

# -----------------------------
# Species labeling: COMMON_NAME
# -----------------------------
species_names <- ref_spp %>% select(SPCD, COMMON_NAME)
tree <- tree %>%
  left_join(species_names, by = "SPCD") %>%
  mutate(spp = dplyr::coalesce(COMMON_NAME, as.character(SPCD))) %>%
  select(-COMMON_NAME)

# ============================================================
# AUDIT: Records dropped by NSVB joins (should be rare now)
# ============================================================
dropped_by_nsvb <- anti_join(
  tree_before_joins %>% select(plot, SPCD, DIA, HT, ACTUALHT, CULL, DECAYCD, status, DIVISION, PROVINCE),
  tree               %>% select(plot, SPCD, DIA, HT, ACTUALHT, CULL, DECAYCD, status, DIVISION, PROVINCE),
  by = c("plot","SPCD","DIA","HT","ACTUALHT","CULL","DECAYCD","status","DIVISION","PROVINCE")
) %>%
  # Null plot placeholders are expected to drop out before NSVB volume joins.
  filter(!(as.character(plot) %in% as.character(null_plots)))

dead_decay_audit <- tree %>%
  filter(stringr::str_to_lower(stringr::str_trim(as.character(status))) == "dead") %>%
  summarise(
    dead_tree_records = n(),
    missing_DECAYCD = sum(is.na(DECAYCD)),
    DECAYCD_used_for_sound = sum(DECAYCD_USED_FOR_SOUND, na.rm = TRUE),
    dead_trees_with_field_CULL = sum(!is.na(CULL) & CULL > 0, na.rm = TRUE),
    .groups = "drop"
  )

cat("\n=== DATA AUDIT - dead tree DECAYCD sound-volume handling =====\n")
print(dead_decay_audit)
cat("DECAYCD is used only for dead trees where CULL is blank or 0.\n")
cat("============================================================\n")
write_csv(dead_decay_audit, "dead_tree_decay_sound_audit.csv")

if (nrow(dropped_by_nsvb) > 0) {
  cat("\n=== DATA AUDIT — NSVB joins removed records =================\n")
  cat("Count removed (no coefficients found even at NA/national rows): ", nrow(dropped_by_nsvb), "\n", sep = "")
  dropped_by_nsvb %>%
    transmute(plot, SPCD, DIA, HT) %>%
    distinct() %>%
    arrange(plot, SPCD, DIA) %>%
    print(n = Inf)
  cat("============================================================\n")
}

# -----------------------------
# PRINT: Per-tree volumes (NSVB)
# -----------------------------
cat("\n=== PER-TREE VOLUMES (NSVB) — one row per record ===\n")
tree %>%
  select(
    plot, spp, DIA, HT, ACTUALHT, status, DECAYCD, CULL, DECAY_CULL_PCT, SOUND_CULL_PCT, SOUND_HEIGHT_FACTOR,
    V_tot_ib_Gross, V_tot_bk_Gross, V_tot_ob_Gross,
    V_tot_ib_Sound, V_tot_bk_Sound, V_tot_ob_Sound
  ) %>%
  arrange(plot, spp, DIA) %>%
  print(n = 50)

# ============================================================
# PART B — Stock & Stand Summaries (TPA, BA/ac, Volume/ac) + Plots
# ============================================================
if (!"plot" %in% names(tree)) {
  stop("Column 'plot' is required for per-plot stock/stand summaries.")
}

dat1_raw <- tree %>%
  mutate(
    plot = factor(str_trim(as.character(plot)), levels = all_sampled_plots),
    spp  = as.character(spp),
    dbh  = as.numeric(DIA)
  )

dat1 <- dat1_raw %>%
  mutate(
    BA_ft2    = 0.005454 * dbh^2,
    TPA_tree  = BAF / BA_ft2,
    BAac_tree = TPA_tree * BA_ft2
  ) %>%
  filter(!is.na(plot), !is.na(spp), !is.na(dbh), dbh > 0)

dropped_by_base_filter <- anti_join(
  dat1_raw %>% select(plot, spp, dbh),
  dat1     %>% select(plot, spp, dbh),
  by = c("plot","spp","dbh")
)
if (nrow(dropped_by_base_filter) > 0) {
  cat("\n=== DATA AUDIT — base filter removed records ================\n")
  cat("Count removed due to missing plot/spp/dbh or dbh <= 0: ", nrow(dropped_by_base_filter), "\n")
  print(dropped_by_base_filter, n = Inf)
  cat("============================================================\n")
}

if (!"status" %in% names(dat1)) {
  stop("Column 'status' not found in cruise_data. Add a 'status' column with values 'live' or 'dead'.")
}

dat1_pre_status <- dat1
dat1 <- dat1 %>%
  mutate(status = tolower(status)) %>%
  filter(status %in% c("live", "dead"))

plots   <- all_sampled_plots
species <- sort(unique(dat1$spp))
n_plots <- length(plots)
cat("Sampled plots used in summaries, including null plots: ", n_plots, "\n")

status_dropped <- dat1_pre_status %>%
  filter(is.na(status) | !(tolower(status) %in% c("live","dead")))
if (nrow(status_dropped) > 0) {
  cat("\n=== DATA AUDIT — status filter removed records ===============\n")
  cat("Count removed because status not 'live' or 'dead': ", nrow(status_dropped), "\n")
  status_dropped %>%
    transmute(plot, SPCD = as.character(SPCD), DIA = as.numeric(DIA), status) %>%
    arrange(plot, SPCD, DIA) %>%
    print(n = Inf)
  cat("============================================================\n")
}

if (nrow(dropped_by_nsvb) == 0 &&
    nrow(dropped_by_base_filter) == 0 &&
    nrow(status_dropped) == 0) {
  cat("\n=== DATA AUDIT — No records dropped ===\n")
}

# 1) BY LIVE / DEAD
status_plot <- dat1 %>%
  group_by(plot, status) %>%
  summarise(
    BA_ac = BAF * n(),
    TPA   = sum(TPA_tree),
    .groups = "drop"
  ) %>%
  complete(plot = plots, status = c("live","dead"),
           fill = list(BA_ac = 0, TPA = 0))

status_summary <- status_plot %>%
  group_by(status) %>%
  summarise(
    BA_ac_mean = mean(BA_ac), BA_ac_sd = sd(BA_ac), BA_ac_se = BA_ac_sd / sqrt(n_plots),
    BA_ac_cv   = ifelse(BA_ac_mean > 0, 100 * BA_ac_sd / BA_ac_mean, NA),
    TPA_mean   = mean(TPA),   TPA_sd   = sd(TPA),   TPA_se   = TPA_sd / sqrt(n_plots),
    TPA_cv     = ifelse(TPA_mean > 0, 100 * TPA_sd / TPA_mean, NA),
    n_plots    = n_plots,
    .groups    = "drop"
  )

# 2) BY SPECIES AND LIVE/DEAD
species_status_plot <- dat1 %>%
  group_by(plot, spp, status) %>%
  summarise(
    BA_ac = BAF * n(),
    TPA   = sum(TPA_tree),
    .groups = "drop"
  ) %>%
  complete(plot = plots, spp = species, status = c("live","dead"),
           fill = list(BA_ac = 0, TPA = 0))

species_status_summary <- species_status_plot %>%
  group_by(spp, status) %>%
  summarise(
    BA_ac_mean = mean(BA_ac), BA_ac_sd = sd(BA_ac), BA_ac_se = BA_ac_sd / sqrt(n_plots),
    BA_ac_cv   = ifelse(BA_ac_mean > 0, 100 * BA_ac_sd / BA_ac_mean, NA),
    TPA_mean   = mean(TPA),   TPA_sd   = sd(TPA),   TPA_se   = TPA_sd / sqrt(n_plots),
    TPA_cv     = ifelse(TPA_mean > 0, 100 * TPA_sd / TPA_mean, NA),
    n_plots    = n_plots,
    .groups    = "drop"
  ) %>%
  arrange(spp, status)

write_csv(status_summary, "status_ba_tpa_live_dead_summary.csv")
write_csv(species_status_summary, "species_status_ba_tpa_live_dead_summary.csv")

# Species metrics per plot (include volume per acre)
species_plot <- dat1 %>%
  group_by(plot, spp) %>%
  summarise(
    BA_ac  = BAF * n(),
    TPA    = sum(TPA_tree),
    VIB_Gross_ac = sum(V_tot_ib_Gross * TPA_tree, na.rm = TRUE),
    VOB_Gross_ac = sum(V_tot_ob_Gross * TPA_tree, na.rm = TRUE),
    VIB_Sound_ac = sum(V_tot_ib_Sound * TPA_tree, na.rm = TRUE),
    VOB_Sound_ac = sum(V_tot_ob_Sound * TPA_tree, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  complete(plot = plots, spp  = species,
           fill = list(BA_ac = 0, TPA = 0,
                       VIB_Gross_ac = 0, VOB_Gross_ac = 0,
                       VIB_Sound_ac = 0, VOB_Sound_ac = 0))

species_summary <- species_plot %>%
  group_by(spp) %>%
  summarise(
    BA_ac_mean = mean(BA_ac), BA_ac_sd = sd(BA_ac), BA_ac_se = BA_ac_sd / sqrt(n_plots),
    BA_ac_cv   = ifelse(BA_ac_mean > 0, 100 * BA_ac_sd / BA_ac_mean, NA_real_),
    TPA_mean   = mean(TPA),   TPA_sd   = sd(TPA),   TPA_se   = TPA_sd / sqrt(n_plots),
    TPA_cv     = ifelse(TPA_mean > 0, 100 * TPA_sd / TPA_mean, NA_real_),
    VIB_Gross_mean = mean(VIB_Gross_ac), VIB_Gross_sd = sd(VIB_Gross_ac),
    VIB_Gross_se   = VIB_Gross_sd / sqrt(n_plots),
    VIB_Gross_cv   = ifelse(VIB_Gross_mean > 0, 100 * VIB_Gross_sd / VIB_Gross_mean, NA_real_),
    VOB_Gross_mean = mean(VOB_Gross_ac), VOB_Gross_sd = sd(VOB_Gross_ac),
    VOB_Gross_se   = VOB_Gross_sd / sqrt(n_plots),
    VOB_Gross_cv   = ifelse(VOB_Gross_mean > 0, 100 * VOB_Gross_sd / VOB_Gross_mean, NA_real_),
    VIB_Sound_mean = mean(VIB_Sound_ac), VIB_Sound_sd = sd(VIB_Sound_ac),
    VIB_Sound_se   = VIB_Sound_sd / sqrt(n_plots),
    VIB_Sound_cv   = ifelse(VIB_Sound_mean > 0, 100 * VIB_Sound_sd / VIB_Sound_mean, NA_real_),
    VOB_Sound_mean = mean(VOB_Sound_ac), VOB_Sound_sd = sd(VOB_Sound_ac),
    VOB_Sound_se   = VOB_Sound_sd / sqrt(n_plots),
    VOB_Sound_cv   = ifelse(VOB_Sound_mean > 0, 100 * VOB_Sound_sd / VOB_Sound_mean, NA_real_),
    n_plots = n_plots,
    .groups = "drop"
  ) %>%
  arrange(spp)

# Totals across plots
total_plot <- dat1 %>%
  group_by(plot) %>%
  summarise(
    BA_ac  = BAF * n(),
    TPA    = sum(TPA_tree),
    VIB_Gross_ac = sum(V_tot_ib_Gross * TPA_tree, na.rm = TRUE),
    VOB_Gross_ac = sum(V_tot_ob_Gross * TPA_tree, na.rm = TRUE),
    VIB_Sound_ac = sum(V_tot_ib_Sound * TPA_tree, na.rm = TRUE),
    VOB_Sound_ac = sum(V_tot_ob_Sound * TPA_tree, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  # FIX NULL PLOTS 2/2:
  # Total stand summaries did not previously zero-fill plots with no tallied
  # trees. Completing against the raw sampled-plot list makes null plots count
  # as zero observations instead of disappearing from the mean/SE denominator.
  complete(plot = plots,
           fill = list(BA_ac = 0, TPA = 0,
                       VIB_Gross_ac = 0, VOB_Gross_ac = 0,
                       VIB_Sound_ac = 0, VOB_Sound_ac = 0))

total_summary <- total_plot %>%
  summarise(
    group      = "Total",
    BA_ac_mean = mean(BA_ac), BA_ac_sd = sd(BA_ac), BA_ac_se = BA_ac_sd / sqrt(n_plots),
    BA_ac_cv   = ifelse(BA_ac_mean > 0, 100 * BA_ac_sd / BA_ac_mean, NA_real_),
    TPA_mean   = mean(TPA),   TPA_sd   = sd(TPA),   TPA_se   = TPA_sd / sqrt(n_plots),
    TPA_cv     = ifelse(TPA_mean > 0, 100 * TPA_sd / TPA_mean, NA_real_),
    VIB_Gross_mean = mean(VIB_Gross_ac), VIB_Gross_sd = sd(VIB_Gross_ac),
    VIB_Gross_se   = VIB_Gross_sd / sqrt(n_plots),
    VIB_Gross_cv   = ifelse(VIB_Gross_mean > 0, 100 * VIB_Gross_sd / VIB_Gross_mean, NA_real_),
    VOB_Gross_mean = mean(VOB_Gross_ac), VOB_Gross_sd = sd(VOB_Gross_ac),
    VOB_Gross_se   = VOB_Gross_sd / sqrt(n_plots),
    VOB_Gross_cv   = ifelse(VOB_Gross_mean > 0, 100 * VOB_Gross_sd / VOB_Gross_mean, NA_real_),
    VIB_Sound_mean = mean(VIB_Sound_ac), VIB_Sound_sd = sd(VIB_Sound_ac),
    VIB_Sound_se   = VIB_Sound_sd / sqrt(n_plots),
    VIB_Sound_cv   = ifelse(VIB_Sound_mean > 0, 100 * VIB_Sound_sd / VIB_Sound_mean, NA_real_),
    VOB_Sound_mean = mean(VOB_Sound_ac), VOB_Sound_sd = sd(VOB_Sound_ac),
    VOB_Sound_se   = VOB_Sound_sd / sqrt(n_plots),
    VOB_Sound_cv   = ifelse(VOB_Sound_mean > 0, 100 * VOB_Sound_sd / VOB_Sound_mean, NA_real_),
    n_plots    = n_plots
  )

stock_table <- bind_rows(
  species_summary %>%
    mutate(group = spp) %>%
    select(
      group,
      BA_ac_mean, BA_ac_se, BA_ac_cv,
      TPA_mean,   TPA_se,   TPA_cv,
      VIB_Gross_mean, VIB_Gross_se, VIB_Gross_cv,
      VOB_Gross_mean, VOB_Gross_se, VOB_Gross_cv,
      VIB_Sound_mean, VIB_Sound_se, VIB_Sound_cv,
      VOB_Sound_mean, VOB_Sound_se, VOB_Sound_cv,
      n_plots
    ),
  total_summary %>%
    select(
      group,
      BA_ac_mean, BA_ac_se, BA_ac_cv,
      TPA_mean,   TPA_se,   TPA_cv,
      VIB_Gross_mean, VIB_Gross_se, VIB_Gross_cv,
      VOB_Gross_mean, VOB_Gross_se, VOB_Gross_cv,
      VIB_Sound_mean, VIB_Sound_se, VIB_Sound_cv,
      VOB_Sound_mean, VOB_Sound_se, VOB_Sound_cv,
      n_plots
    )
) %>%
  arrange(group)

# ---- CSV OUTPUTS and Average Crown Ratio ----
write_csv(
  species_summary %>%
    select(
      spp,
      BA_ac_mean, TPA_mean,
      VIB_Gross_mean, VOB_Gross_mean,
      VIB_Sound_mean, VOB_Sound_mean
    ),
  "species_ba_tpa_volume_gross_sound.csv"
)


# === Crown Ratio Summary (single-stage cluster estimator) ===
crown_ratio_by_species <- dat1 %>%
  filter(!is.na(.data[[crown_ratio_col]])) %>%
  group_by(plot, spp) %>%
  summarise(
    yi = sum(.data[[crown_ratio_col]], na.rm = TRUE),
    mi = n(),
    .groups = "drop"
  ) %>%
  group_by(spp) %>%
  summarise(
    crown_ratio_mean = sum(yi) / sum(mi),
    total_yi = sum(yi),
    total_mi = sum(mi),
    .groups = "drop"
  ) %>%
  arrange(spp)

write_csv(crown_ratio_by_species, "species_crown_ratio_summary.csv")

write_csv(
  total_summary %>%
    select(
      group,
      BA_ac_mean, BA_ac_se, BA_ac_cv,
      TPA_mean, TPA_se, TPA_cv,
      VIB_Gross_mean, VIB_Gross_se, VIB_Gross_cv,
      VOB_Gross_mean, VOB_Gross_se, VOB_Gross_cv,
      VIB_Sound_mean, VIB_Sound_se, VIB_Sound_cv,
      VOB_Sound_mean, VOB_Sound_se, VOB_Sound_cv,
      n_plots
    ),
  "stand_totals_ba_tpa_volume_gross_sound.csv"
)

write_csv(stock_table, "combined_stock_table_gross_sound.csv")

# ---- Stand table: DBH classes ----
dbh_breaks <- seq(
  0,
  ceiling(max(dat1$dbh, na.rm = TRUE) + dbh_class_width),
  by = dbh_class_width
)

dat_classes <- dat1 %>%
  mutate(
    dbh_class   = cut(dbh, breaks = dbh_breaks, right = FALSE, include.lowest = TRUE),
    class_index = as.integer(dbh_class),
    dbh_lower   = dbh_breaks[class_index],
    dbh_class   = forcats::fct_drop(dbh_class)
  )

stand_plot <- dat_classes %>%
  group_by(plot, spp, dbh_lower) %>%
  summarise(
    TPA   = sum(TPA_tree),
    BA_ac = sum(BAac_tree),
    .groups = "drop"
  ) %>%
  complete(plot = plots, spp  = species, dbh_lower = unique(dat_classes$dbh_lower),
           fill = list(TPA = 0, BA_ac = 0))

stand_table <- stand_plot %>%
  group_by(spp, dbh_lower) %>%
  summarise(
    TPA_mean   = mean(TPA),
    TPA_se     = sd(TPA) / sqrt(n_plots),
    TPA_cv     = ifelse(TPA_mean > 0, 100 * sd(TPA) / TPA_mean, NA_real_),
    BA_ac_mean = mean(BA_ac),
    BA_ac_se   = sd(BA_ac) / sqrt(n_plots),
    BA_ac_cv   = ifelse(BA_ac_mean > 0, 100 * sd(BA_ac) / BA_ac_mean, NA_real_),
    n_plots    = n_plots,
    .groups    = "drop"
  ) %>%
  arrange(spp, dbh_lower)

stand_total <- stand_plot %>%
  group_by(plot, dbh_lower) %>%
  summarise(TPA = sum(TPA), BA_ac = sum(BA_ac), .groups = "drop") %>%
  group_by(dbh_lower) %>%
  summarise(
    group      = "Total",
    TPA_mean   = mean(TPA),
    TPA_se     = sd(TPA) / sqrt(n_plots),
    TPA_cv     = ifelse(TPA_mean > 0, 100 * sd(TPA) / TPA_mean, NA_real_),
    BA_ac_mean = mean(BA_ac),
    BA_ac_se   = sd(BA_ac) / sqrt(n_plots),
    BA_ac_cv   = ifelse(BA_ac_mean > 0, 100 * sd(BA_ac) / BA_ac_mean, NA_real_),
    n_plots    = n_plots,
    .groups    = "drop"
  ) %>%
  arrange(dbh_lower)

# ---- Console summaries ----
cat("\n=== STOCK TABLE (species & total) — COMMON_NAME labels ===\n")
print(stock_table, n = nrow(stock_table))

cat("\n=== VOLUME PER ACRE — GROSS VOLUME ===\n")
stock_table %>%
  select(group, VOB_Gross_mean, VOB_Gross_se, VOB_Gross_cv, VIB_Gross_mean, VIB_Gross_se, VIB_Gross_cv, n_plots) %>%
  arrange(group) %>%
  print(n = nrow(stock_table))

cat("\n=== VOLUME PER ACRE — SOUND VOLUME ===\n")
stock_table %>%
  select(group, VOB_Sound_mean, VOB_Sound_se, VOB_Sound_cv, VIB_Sound_mean, VIB_Sound_se, VIB_Sound_cv, n_plots) %>%
  arrange(group) %>%
  print(n = nrow(stock_table))

cat("\n=== STAND TABLE (species × 2-inch DBH class) ===\n")
print(head(stand_table, 20), n = 20)

cat("\n=== STAND TOTALS (all species × 2-inch DBH class) ===\n")
print(head(stand_total, 20), n = 20)

# ============================================================
# PART C — Plots
# ============================================================
p_species_tpa <- ggplot(species_summary,
                        aes(x = reorder(spp, -TPA_mean),
                            y = TPA_mean,
                            fill = spp)) +     # ← species-based coloring
  geom_col(colour = "black", linewidth = 0.50) +
  labs(title = "Species Trees per Acre",
       x = "Species (Common Name)", y = "TPA (trees/ac)") +
  theme_minimal(base_size = 12) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        legend.position = "none") +   # optional: hide legend
  scale_fill_viridis_d(option = "turbo")   # or "viridis", "magma", etc.
print(p_species_tpa)

p_species_ba <- ggplot(species_summary,
                       aes(x = reorder(spp, -BA_ac_mean),
                           y = BA_ac_mean,
                           fill = spp)) +     # ← species-based coloring
  geom_col(colour = "black", linewidth = 0.50) +
  labs(title = "Species Basal Area per Acre",
       x = "Species (Common Name)", y = "BA/ac (ft²/ac)") +
  theme_minimal(base_size = 12) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        legend.position = "none") +
  scale_fill_viridis_d(option = "plasma")
print(p_species_ba)

p_class_tpa <- ggplot(stand_total, aes(x = dbh_lower, y = TPA_mean)) +
  geom_col(width = dbh_class_width, fill = "#225EA8", colour = "black", linewidth = 0.50) +
  scale_x_continuous(breaks = unique(stand_total$dbh_lower),
                     labels = as.character(unique(stand_total$dbh_lower)),
                     expand = c(0, 0)) +
  labs(title = "Trees per Acre by 2-inch DBH Class", x = "DBH Class (inches)", y = "TPA (trees/ac)") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.major = element_blank(), panel.grid.minor = element_blank())
print(p_class_tpa)

p_class_ba <- ggplot(stand_total, aes(x = dbh_lower, y = BA_ac_mean)) +
  geom_col(width = dbh_class_width, fill = "#41B6C4", colour = "black", linewidth = 0.50) +
  scale_x_continuous(breaks = unique(stand_total$dbh_lower),
                     labels = as.character(unique(stand_total$dbh_lower)),
                     expand = c(0, 0)) +
  labs(title = "Basal Area per Acre by 2-inch DBH Class", x = "DBH Class (inches)", y = "BA/ac (ft\u00B2/ac)") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.major = element_blank(), panel.grid.minor = element_blank())
print(p_class_ba)

