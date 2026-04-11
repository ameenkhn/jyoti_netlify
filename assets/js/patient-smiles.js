(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanLine(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function uniqueLines(lines) {
    var seen = new Set();
    return lines.filter(function (line) {
      var cleaned = cleanLine(line);
      if (!cleaned || seen.has(cleaned)) {
        return false;
      }
      seen.add(cleaned);
      return true;
    });
  }

  function looksLikeMeta(line) {
    var compact = cleanLine(line).toLowerCase();
    if (!compact) {
      return false;
    }

    if (
      compact.includes("date of birth") ||
      compact.includes("dob") ||
      compact.includes("baby name") ||
      compact.includes("year of delivery") ||
      compact.includes("mother name") ||
      compact.includes("with love") ||
      compact.includes("with gratitude") ||
      compact.includes("with regards") ||
      compact.includes("blessed with")
    ) {
      return true;
    }

    if (compact.length < 110 && /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(compact)) {
      return true;
    }

    if (
      compact.length < 110 &&
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(compact)
    ) {
      return true;
    }

    return false;
  }

  function prepareEntry(entry) {
    var lines = uniqueLines(
      [entry.subtitle]
        .concat(entry.paragraphs || [])
        .concat(entry.meta_lines || [])
        .map(cleanLine)
    );

    var storyLines = [];
    var metaLines = [];

    lines.forEach(function (line) {
      if (looksLikeMeta(line)) {
        metaLines.push(line);
      } else {
        storyLines.push(line);
      }
    });

    if (storyLines.length === 0 && metaLines.length > 0) {
      storyLines.push(metaLines.shift());
    }

    var eyebrow = "";
    if (storyLines.length > 1 && storyLines[0].length < 88) {
      eyebrow = storyLines.shift();
    } else if (metaLines.length > 0 && metaLines[0].length < 88) {
      eyebrow = metaLines[0];
    }

    var summary = storyLines[0] || metaLines[0] || "Shared with gratitude by the family.";
    var support = storyLines[1] || "";
    var chips = metaLines.slice(0, 3);

    return {
      title: entry.title,
      images: Array.isArray(entry.images) ? entry.images : [],
      eyebrow: cleanLine(eyebrow),
      summary: cleanLine(summary),
      support: cleanLine(support),
      chips: chips.map(cleanLine).filter(Boolean),
    };
  }

  function renderHiddenImages(images, title) {
    return images
      .slice(1)
      .map(function (imagePath) {
        return (
          '<a href="' +
          escapeHtml(imagePath) +
          '" class="popup-image jyoti-lightbox-hidden" aria-label="View additional photo of ' +
          escapeHtml(title) +
          '"></a>'
        );
      })
      .join("");
  }

  function renderPhotoBadge(images) {
    if (!Array.isArray(images) || images.length < 2) {
      return "";
    }

    return (
      '<span class="jyoti-story-photo-count">' +
      escapeHtml(images.length) +
      " photos</span>"
    );
  }

  function renderChips(chips) {
    if (!Array.isArray(chips) || chips.length === 0) {
      return "";
    }

    return (
      '<div class="jyoti-story-chip-row">' +
      chips
        .map(function (chip) {
          return "<span>" + escapeHtml(chip) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function renderStoryCard(entry) {
    var prepared = prepareEntry(entry);
    var imagePath = prepared.images[0] || "";
    var eyebrow = prepared.eyebrow
      ? '<p class="jyoti-story-eyebrow">' + escapeHtml(prepared.eyebrow) + "</p>"
      : "";
    var support = prepared.support
      ? '<p class="jyoti-story-support">' + escapeHtml(prepared.support) + "</p>"
      : "";

    return (
      '<article class="jyoti-story-card">' +
      '<div class="jyoti-lightbox-group jyoti-story-media">' +
      '<a href="' +
      escapeHtml(imagePath) +
      '" class="jyoti-story-cover popup-image" aria-label="View patient photo of ' +
      escapeHtml(prepared.title) +
      '">' +
      '<img loading="lazy" src="' +
      escapeHtml(imagePath) +
      '" alt="Patient smile of ' +
      escapeHtml(prepared.title) +
      '">' +
      renderPhotoBadge(prepared.images) +
      "</a>" +
      renderHiddenImages(prepared.images, prepared.title) +
      "</div>" +
      '<div class="jyoti-story-content">' +
      '<div class="jyoti-story-topline"><span class="jyoti-story-badge">Patient Story</span></div>' +
      "<h3>" +
      escapeHtml(prepared.title) +
      "</h3>" +
      eyebrow +
      '<p class="jyoti-story-summary">' +
      escapeHtml(prepared.summary) +
      "</p>" +
      support +
      renderChips(prepared.chips) +
      "</div>" +
      "</article>"
    );
  }

  function renderSpotlight(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return "";
    }

    var lead = prepareEntry(entries[0]);
    var leadImage = lead.images[0] || "";
    var rail = entries.slice(1, 4).map(function (entry) {
      var prepared = prepareEntry(entry);
      var imagePath = prepared.images[0] || "";
      return (
        '<article class="jyoti-gallery-rail-card">' +
        '<div class="jyoti-lightbox-group jyoti-gallery-rail-media">' +
        '<a href="' +
        escapeHtml(imagePath) +
        '" class="popup-image" aria-label="View patient photo of ' +
        escapeHtml(prepared.title) +
        '">' +
        '<img loading="lazy" src="' +
        escapeHtml(imagePath) +
        '" alt="Patient smile of ' +
        escapeHtml(prepared.title) +
        '">' +
        "</a>" +
        renderHiddenImages(prepared.images, prepared.title) +
        "</div>" +
        '<div class="jyoti-gallery-rail-copy">' +
        "<h4>" +
        escapeHtml(prepared.title) +
        "</h4>" +
        '<p>' +
        escapeHtml(prepared.eyebrow || prepared.summary) +
        "</p>" +
        "</div>" +
        "</article>"
      );
    });

    return (
      '<div class="jyoti-gallery-spotlight-grid">' +
      '<article class="jyoti-gallery-feature-card">' +
      '<div class="jyoti-lightbox-group jyoti-gallery-feature-media">' +
      '<a href="' +
      escapeHtml(leadImage) +
      '" class="popup-image" aria-label="View patient photo of ' +
      escapeHtml(lead.title) +
      '">' +
      '<img loading="lazy" src="' +
      escapeHtml(leadImage) +
      '" alt="Featured patient smile of ' +
      escapeHtml(lead.title) +
      '">' +
      renderPhotoBadge(lead.images) +
      "</a>" +
      renderHiddenImages(lead.images, lead.title) +
      "</div>" +
      '<div class="jyoti-gallery-feature-copy">' +
      '<span class="jyoti-story-badge">Featured Story</span>' +
      "<h3>" +
      escapeHtml(lead.title) +
      "</h3>" +
      (lead.eyebrow
        ? '<p class="jyoti-gallery-feature-eyebrow">' + escapeHtml(lead.eyebrow) + "</p>"
        : "") +
      '<p class="jyoti-gallery-feature-summary">' +
      escapeHtml(lead.summary) +
      "</p>" +
      (lead.support
        ? '<p class="jyoti-gallery-feature-support">' + escapeHtml(lead.support) + "</p>"
        : "") +
      renderChips(lead.chips) +
      "</div>" +
      "</article>" +
      '<div class="jyoti-gallery-spotlight-rail">' +
      rail.join("") +
      "</div>" +
      "</div>"
    );
  }

  function initImagePopup() {
    if (!window.jQuery || !jQuery.fn || !jQuery.fn.magnificPopup) {
      return;
    }

    jQuery(".jyoti-lightbox-group").each(function () {
      var group = jQuery(this);
      if (group.data("mfp-bound")) {
        return;
      }

      group.magnificPopup({
        delegate: "a.popup-image",
        type: "image",
        gallery: {
          enabled: true,
        },
        removalDelay: 180,
        mainClass: "mfp-fade",
      });

      group.data("mfp-bound", true);
    });
  }

  function setStat(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("patientSmilesGrid");
    var spotlight = document.getElementById("patientSmilesSpotlight");

    if (!grid || !spotlight) {
      return;
    }

    fetch("assets/data/patient-smiles.json")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load patient smiles data");
        }
        return response.json();
      })
      .then(function (entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
          var empty =
            '<div class="jyoti-patient-empty">Patient stories will be added here shortly.</div>';
          spotlight.innerHTML = empty;
          grid.innerHTML = empty;
          return;
        }

        var preparedEntries = entries.map(prepareEntry);
        var totalPhotos = preparedEntries.reduce(function (sum, entry) {
          return sum + entry.images.length;
        }, 0);
        var notesCount = preparedEntries.filter(function (entry) {
          return Boolean(entry.summary);
        }).length;

        setStat("patientSmilesEntryCount", preparedEntries.length + "+");
        setStat("patientSmilesPhotoCount", totalPhotos + "+");
        setStat("patientSmilesNoteCount", notesCount + "+");

        spotlight.innerHTML = renderSpotlight(entries.slice(0, 4));

        var wallEntries = entries.length > 4 ? entries.slice(4) : entries;
        grid.innerHTML = wallEntries.map(renderStoryCard).join("");
        initImagePopup();
      })
      .catch(function () {
        var fallback =
          '<div class="jyoti-patient-empty">Patient stories are temporarily unavailable. Please try again shortly.</div>';
        spotlight.innerHTML = fallback;
        grid.innerHTML = fallback;
      });
  });
})();
