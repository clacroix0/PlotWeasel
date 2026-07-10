# Plot Weasel Desktop - ggplot graph source (Part C)
# Preserved for R users from PlotWeasel_V8_current.R.
#
# The offline HTML app draws its Graphs tab in the browser, so it does not
# require R, ggplot2, or an installed R package library to run.
#
# To run this R graph code separately, the objects below must already exist:
# - species_summary
# - stand_total
# - dbh_class_width
#
# Required package:
# - ggplot2

library(ggplot2)

p_species_tpa <- ggplot(species_summary,
                        aes(x = reorder(spp, -TPA_mean),
                            y = TPA_mean,
                            fill = spp)) +
  geom_col(colour = "black", linewidth = 0.50) +
  labs(title = "Species Trees per Acre",
       x = "Species (Common Name)", y = "TPA (trees/ac)") +
  theme_minimal(base_size = 12) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        legend.position = "none") +
  scale_fill_viridis_d(option = "turbo")
print(p_species_tpa)

p_species_ba <- ggplot(species_summary,
                       aes(x = reorder(spp, -BA_ac_mean),
                           y = BA_ac_mean,
                           fill = spp)) +
  geom_col(colour = "black", linewidth = 0.50) +
  labs(title = "Species Basal Area per Acre",
       x = "Species (Common Name)", y = "BA/ac (ft2/ac)") +
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
  labs(title = "Trees per Acre by 2-inch DBH Class",
       x = "DBH Class (inches)", y = "TPA (trees/ac)") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.major = element_blank(), panel.grid.minor = element_blank())
print(p_class_tpa)

p_class_ba <- ggplot(stand_total, aes(x = dbh_lower, y = BA_ac_mean)) +
  geom_col(width = dbh_class_width, fill = "#41B6C4", colour = "black", linewidth = 0.50) +
  scale_x_continuous(breaks = unique(stand_total$dbh_lower),
                     labels = as.character(unique(stand_total$dbh_lower)),
                     expand = c(0, 0)) +
  labs(title = "Basal Area per Acre by 2-inch DBH Class",
       x = "DBH Class (inches)", y = "BA/ac (ft2/ac)") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.major = element_blank(), panel.grid.minor = element_blank())
print(p_class_ba)
