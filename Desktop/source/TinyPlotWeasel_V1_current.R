# ============================================================
#   Tiny Plot Weasel — regen analyzer 
# ============================================================

# 0) Packages -------------------------------------------------
req_pkgs <- c(
  "tidyverse","readr","ggplot2","scales",
  "rayshader","rgl","stringr","tidyr"
)
new_pkgs <- setdiff(req_pkgs, rownames(installed.packages()))
if (length(new_pkgs)) install.packages(new_pkgs, dependencies = TRUE)
lapply(req_pkgs, library, character.only = TRUE)

# 1) Constants/Paths -----------------------------------------
input_csv <- "Shelterwood_regen.csv"
out_dir   <- file.path("outputs","regen_viz")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

expansion_factor <- 250   # 1/250-ac fixed-area microplot

# 2) Load + Clean --------------------------------------------
regen_raw <- read_csv(input_csv, show_col_types = FALSE)

# Identify null plot rows (the CSV contains a row starting with "null")
null_plots <- regen_raw %>%
  filter(tolower(plot) == "null") %>%
  mutate(plot = NA) %>% 
  pull(plot)

# List of all *valid* numeric plots in dataset
plot_list <- regen_raw %>%
  filter(!tolower(plot) == "null") %>%
  mutate(plot = as.character(plot)) %>%
  pull(plot) %>%
  unique()

# Add null plot ID(s) as TRUE null plots
# We'll give them IDs such as "null_1", "null_2" if multiple exist.
if (length(null_plots) > 0) {
  null_ids <- paste0("null_", seq_along(null_plots))
  plot_list <- c(plot_list, null_ids)
}

# Remove null rows from raw regen for cleaning
regen_clean_raw <- regen_raw %>%
  filter(!tolower(plot) == "null")

# Clean measured data ----------------------------------------
regen <- regen_clean_raw %>%
  mutate(
    plot           = as.character(plot),
    species        = spp,
    stems          = `Stem Count`,
    diameter_class = `Diameter Class`,
    height_class   = `Height Class`
  ) %>%
  mutate(
    diameter_in  = readr::parse_number(diameter_class),
    height_class = stringr::str_replace_all(height_class, "–", "-"),
    height_class = factor(height_class,
                          levels  = c("0-1 ft","1-3 ft","3-5 ft",">5 ft"),
                          ordered = TRUE)
  ) %>%
  select(plot, species, stems, diameter_in, height_class)

# 3) Group oak spp. ------------------------------------------
oak_whitelist <- c("northern red oak","black oak","white oak")

regen <- regen %>%
  mutate(
    is_oak = if_else(
      str_detect(species, regex("oak", ignore_case = TRUE)) |
        species %in% oak_whitelist,
      TRUE, FALSE
    ),
    group = if_else(is_oak, "oak (Quercus)", "All other spp.")
  )

# ------------------------------------------------------------
# 4) CORRECT TPA INCLUDING NULL PLOTS
# ------------------------------------------------------------

# (A) Per-plot overall TPA -----------------------------------
tpa_by_plot <- regen %>%
  group_by(plot) %>%
  summarise(
    tpa_plot = sum(stems) * expansion_factor,
    .groups = "drop"
  ) %>%
  # Add null plots with 0 TPA
  complete(plot = plot_list, fill = list(tpa_plot = 0))

# (B) Overall mean TPA ---------------------------------------
overall_mean_tpa <- tpa_by_plot %>%
  summarise(
    mean_tpa = mean(tpa_plot),
    n_plots  = n()
  )

# (C) Species mean TPA — includes null plots ------------------
species_mean_tpa <- regen %>%
  group_by(plot, species) %>%
  summarise(
    tpa_plot = sum(stems) * expansion_factor,
    .groups = "drop"
  ) %>%
  # Complete with all plots (including null) and all species present
  complete(plot = plot_list,
           species,
           fill = list(tpa_plot = 0)) %>%
  group_by(species) %>%
  summarise(
    mean_tpa = mean(tpa_plot),
    n_plots  = n(),
    .groups  = "drop"
  ) %>%
  arrange(desc(mean_tpa))

# (D) Species × height mean TPA — includes null plots --------
species_height_mean_tpa <- regen %>%
  group_by(plot, species, height_class) %>%
  summarise(
    tpa_plot = sum(stems) * expansion_factor,
    .groups = "drop"
  ) %>%
  complete(plot = plot_list,
           species,
           height_class,
           fill = list(tpa_plot = 0)) %>%
  group_by(species, height_class) %>%
  summarise(
    mean_tpa = mean(tpa_plot),
    .groups = "drop"
  )

# 5) Write CSV outputs ---------------------------------------
write_csv(overall_mean_tpa,
          file.path(out_dir, "overall_mean_tpa.csv"))
write_csv(species_mean_tpa,
          file.path(out_dir, "mean_tpa_by_species.csv"))

# 6) 2‑D Charts ------------------------------------------------

# Species bar plot
p_species_bar <- ggplot(species_mean_tpa,
                        aes(x = reorder(species, mean_tpa),
                            y = mean_tpa)) +
  geom_col(fill = "#2A9D8F") +
  coord_flip() +
  scale_y_continuous(labels = scales::comma) +
  labs(
    title = "",
    x = NULL, y = "Trees per acre (TPA)"
  ) +
  theme_minimal(base_size = 14)

p_species_bar <- p_species_bar +
  theme(
    plot.margin = margin(t = 10, r = 30, b = 10, l = 30)
  )



ggsave(
  file.path(out_dir, "mean_tpa_by_species_bar.png"),
  p_species_bar,
  width = 12, height = 6, dpi = 300
)

# Species × height class stacked bar plot
p_species_height <- ggplot(species_height_mean_tpa,
                           aes(x = reorder(species, mean_tpa, sum),
                               y = mean_tpa,
                               fill = height_class)) +
  geom_col(color = "white") +
  coord_flip() +
  scale_y_continuous(labels = scales::comma) +
  scale_fill_manual(
    values = c("#E9F5FF","#A6D4FF","#4DAAF7","#1B74D6")
  ) +
  labs(
    title = "",
    x = NULL, y = "Trees per acre (TPA)",
    fill = "Height class"
  ) +
  theme_minimal(base_size = 12)

ggsave(
  file.path(out_dir, "mean_tpa_by_species_height_stacked.png"),
  p_species_height,
  width = 9, height = 6, dpi = 300
)

# ============================================================
# END OF SCRIPT
# ============================================================