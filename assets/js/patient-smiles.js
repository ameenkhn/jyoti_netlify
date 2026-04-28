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

  function stripMatch(text, fullMatch) {
    if (!fullMatch) return text;
    var idx = text.toLowerCase().indexOf(fullMatch.toLowerCase());
    if (idx === -1) return text;
    var before = text.slice(0, idx);
    var after = text.slice(idx + fullMatch.length);
    return cleanLine(
      (before + " " + after)
        .replace(/\(\s*\)/g, " ")
        .replace(/\s*[,;]\s*$/g, "")
        .replace(/^\s*[,;.\-–]\s*/g, "")
    );
  }

  function titleCase(value) {
    return cleanLine(value).replace(/\b([a-z])/g, function (_, ch) {
      return ch.toUpperCase();
    });
  }

  var NAME_STOPWORDS = {
    mother: 1, father: 1, baby: 1, child: 1, son: 1, daughter: 1,
    dob: 1, date: 1, year: 1, born: 1, age: 1,
    thank: 1, thanks: 1, with: 1,
    my: 1, i: 1, we: 1, you: 1, your: 1, they: 1, she: 1, he: 1, it: 1,
    is: 1, was: 1, am: 1, are: 1, were: 1, be: 1, been: 1,
    a: 1, an: 1, the: 1, and: 1, but: 1, or: 1, of: 1, for: 1, to: 1,
    in: 1, on: 1, at: 1, this: 1, that: 1, these: 1, those: 1,
    no: 1, words: 1, dr: 1, doctor: 1, mam: 1, madam: 1, ma: 1, sir: 1,
    hi: 1, hello: 1
  };

  function extractAfterLabel(text, labelPattern, maxWords) {
    var labelRe = new RegExp(labelPattern + "\\s*[:\\-\\u2013]\\s*", "i");
    var labelMatch = text.match(labelRe);
    if (!labelMatch) return null;
    var afterIdx = labelMatch.index + labelMatch[0].length;
    var rest = text.slice(afterIdx);
    var wordRe = /^\s*([A-Z][A-Za-z'.]*)/;
    var collected = [];
    var consumed = 0;

    while (collected.length < maxWords) {
      var slice = rest.slice(consumed);
      var m = slice.match(wordRe);
      if (!m) break;
      var word = m[1];
      if (NAME_STOPWORDS[word.toLowerCase()]) break;
      consumed += m[0].length;
      collected.push(word);
    }
    if (collected.length === 0) return null;

    var capturedText = rest.slice(0, consumed).replace(/^\s+/, "");
    return {
      value: collected.join(" "),
      fullMatch: text.slice(labelMatch.index, afterIdx + consumed).replace(/\s+$/, ""),
    };
  }

  function extractFields(joinedText) {
    var fields = { babyName: "", dob: "", motherName: "", year: "" };
    var remaining = joinedText;

    var dobLabelRegex = /(?:date\s*of\s*birth|date\s*of\s*delivery|d\.?o\.?b\.?|born\s*on)\s*[:\-–]?\s*((?:[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})|(?:[0-9]{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+[0-9]{2,4}))/i;
    var dobMatch = remaining.match(dobLabelRegex);
    if (dobMatch) {
      fields.dob = cleanLine(dobMatch[1]);
      remaining = stripMatch(remaining, dobMatch[0]);
    }

    var babyResult = extractAfterLabel(
      remaining,
      "(?:baby(?:'?s)?(?:\\s+name)?|child(?:'?s)?(?:\\s+name)?|son(?:'?s\\s+name)?|daughter(?:'?s\\s+name)?)",
      3
    );
    if (babyResult) {
      fields.babyName = cleanLine(babyResult.value);
      remaining = stripMatch(remaining, babyResult.fullMatch);
    }

    var motherResult = extractAfterLabel(remaining, "mother(?:'?s)?\\s+name", 2);
    if (motherResult) {
      fields.motherName = cleanLine(motherResult.value);
      remaining = stripMatch(remaining, motherResult.fullMatch);
    }

    var yearRegex = /year\s*of\s*delivery\s*[:\-–]?\s*(\d{4})/i;
    var yearMatch = remaining.match(yearRegex);
    if (yearMatch) {
      fields.year = yearMatch[1];
      remaining = stripMatch(remaining, yearMatch[0]);
    }

    if (!fields.dob) {
      var standaloneDate = remaining.match(/\b([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})\b/);
      if (standaloneDate) {
        fields.dob = standaloneDate[1];
        remaining = stripMatch(remaining, standaloneDate[0]);
      }
    }

    return { fields: fields, message: remaining };
  }

  function prepareEntry(entry) {
    var allLines = [entry.subtitle]
      .concat(entry.paragraphs || [])
      .concat(entry.meta_lines || [])
      .map(cleanLine)
      .filter(Boolean);

    var seen = new Set();
    var deduped = [];
    allLines.forEach(function (line) {
      var key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(line);
      }
    });

    var combined = deduped.join(" ");
    var extracted = extractFields(combined);
    var fields = extracted.fields;
    var message = extracted.message;

    if (
      fields.motherName &&
      fields.motherName.toLowerCase() === cleanLine(entry.title).toLowerCase()
    ) {
      fields.motherName = "";
    }

    var images = Array.isArray(entry.images) ? entry.images : [];
    var trimmedMessage = cleanLine(message).replace(/^[\-–—:.,;]+\s*/, "").trim();
    var caption = "";
    var quotedMessage = "";

    if (trimmedMessage.length >= 60) {
      quotedMessage = trimmedMessage;
    } else if (trimmedMessage.length > 0) {
      var captionWordCount = trimmedMessage.split(/\s+/).length;
      var titleNorm = cleanLine(entry.title || "").toLowerCase();
      var msgNorm = trimmedMessage.toLowerCase();
      var isEchoOfTitle = msgNorm === titleNorm || titleNorm.indexOf(msgNorm) !== -1;
      var tooThin = trimmedMessage.length < 18 || captionWordCount < 2;
      if (!isEchoOfTitle && !tooThin) {
        caption = trimmedMessage;
      }
    }

    return {
      title: titleCase(entry.title || ""),
      images: images,
      babyName: fields.babyName,
      dob: fields.dob,
      motherName: fields.motherName,
      year: fields.year,
      caption: caption,
      message: quotedMessage,
      hasMessage: Boolean(quotedMessage),
      hasCaption: Boolean(caption),
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
      ' Photos</span>'
    );
  }

  function renderFacts(prepared) {
    var items = [];
    if (prepared.babyName) {
      items.push({ label: "Baby", value: prepared.babyName });
    }
    if (prepared.dob) {
      items.push({ label: "DOB", value: prepared.dob });
    }
    if (prepared.year && !prepared.dob) {
      items.push({ label: "Year", value: prepared.year });
    }
    if (prepared.motherName) {
      items.push({ label: "Mother", value: prepared.motherName });
    }
    if (items.length === 0) {
      return "";
    }
    return (
      '<dl class="jyoti-story-facts">' +
      items
        .map(function (item) {
          return (
            '<div class="jyoti-story-fact">' +
            '<dt>' +
            escapeHtml(item.label) +
            '</dt>' +
            '<dd>' +
            escapeHtml(item.value) +
            '</dd>' +
            '</div>'
          );
        })
        .join("") +
      '</dl>'
    );
  }

  function renderQuote(prepared) {
    var parts = [];
    if (prepared.hasCaption) {
      parts.push(
        '<p class="jyoti-story-caption">' +
          escapeHtml(prepared.caption) +
          '</p>'
      );
    }
    if (prepared.hasMessage) {
      parts.push(
        '<blockquote class="jyoti-story-quote"><p>' +
          escapeHtml(prepared.message) +
          '</p></blockquote>'
      );
    }
    if (parts.length === 0) {
      return '<p class="jyoti-story-meta-note">Shared with gratitude by the family.</p>';
    }
    return parts.join("");
  }

  function renderStoryCard(entry) {
    var prepared = prepareEntry(entry);
    var imagePath = prepared.images[0] || "";

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
      '<span class="jyoti-story-badge">Patient Story</span>' +
      '<h3 class="jyoti-story-name">' +
      escapeHtml(prepared.title) +
      "</h3>" +
      renderFacts(prepared) +
      renderQuote(prepared) +
      "</div>" +
      "</article>"
    );
  }

  function renderRailCard(entry) {
    var prepared = prepareEntry(entry);
    var imagePath = prepared.images[0] || "";
    var snippet = "";
    if (prepared.babyName && prepared.dob) {
      snippet = "Baby " + prepared.babyName + " · " + prepared.dob;
    } else if (prepared.babyName) {
      snippet = "Baby " + prepared.babyName;
    } else if (prepared.dob) {
      snippet = "Born " + prepared.dob;
    } else if (prepared.hasCaption) {
      snippet = prepared.caption;
    } else if (prepared.hasMessage) {
      snippet = prepared.message;
    } else {
      snippet = "Shared with gratitude by the family.";
    }

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
      '<span class="jyoti-story-badge jyoti-story-badge--mini">Patient Story</span>' +
      "<h4>" +
      escapeHtml(prepared.title) +
      "</h4>" +
      '<p>' +
      escapeHtml(snippet) +
      "</p>" +
      "</div>" +
      "</article>"
    );
  }

  function renderFeatureCard(entry) {
    var prepared = prepareEntry(entry);
    var imagePath = prepared.images[0] || "";

    return (
      '<article class="jyoti-gallery-feature-card">' +
      '<div class="jyoti-lightbox-group jyoti-gallery-feature-media">' +
      '<a href="' +
      escapeHtml(imagePath) +
      '" class="popup-image" aria-label="View patient photo of ' +
      escapeHtml(prepared.title) +
      '">' +
      '<img loading="lazy" src="' +
      escapeHtml(imagePath) +
      '" alt="Featured patient smile of ' +
      escapeHtml(prepared.title) +
      '">' +
      renderPhotoBadge(prepared.images) +
      "</a>" +
      renderHiddenImages(prepared.images, prepared.title) +
      "</div>" +
      '<div class="jyoti-gallery-feature-copy">' +
      '<span class="jyoti-story-badge">Featured Story</span>' +
      "<h3>" +
      escapeHtml(prepared.title) +
      "</h3>" +
      renderFacts(prepared) +
      renderQuote(prepared) +
      "</div>" +
      "</article>"
    );
  }

  function renderSpotlight(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return "";
    }
    var rail = entries.slice(1, 4).map(renderRailCard).join("");
    return (
      '<div class="jyoti-gallery-spotlight-grid">' +
      renderFeatureCard(entries[0]) +
      '<div class="jyoti-gallery-spotlight-rail">' +
      rail +
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
        gallery: { enabled: true },
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
          return entry.hasMessage;
        }).length;

        setStat("patientSmilesEntryCount", preparedEntries.length + "+");
        setStat("patientSmilesPhotoCount", totalPhotos + "+");
        setStat("patientSmilesNoteCount", notesCount + "+");

        function isSubstantialCaption(caption) {
          if (!caption) return false;
          var trimmed = caption.trim();
          if (trimmed.length < 25) return false;
          var wordCount = trimmed.split(/\s+/).length;
          return wordCount >= 3;
        }

        function richnessRank(entry) {
          var prepared = prepareEntry(entry);
          if (prepared.hasMessage) {
            return 0;
          }
          if (prepared.hasCaption && isSubstantialCaption(prepared.caption)) {
            return 1;
          }
          if (prepared.babyName || prepared.dob || prepared.motherName || prepared.year) {
            return 2;
          }
          if (prepared.hasCaption) {
            return 3;
          }
          return 4;
        }

        function contentWeight(entry) {
          var prepared = prepareEntry(entry);
          var msgLen = prepared.message ? prepared.message.length : 0;
          var capLen = prepared.caption ? prepared.caption.length : 0;
          return msgLen + capLen * 0.5;
        }

        var sortedEntries = entries.slice().sort(function (a, b) {
          var rankDiff = richnessRank(a) - richnessRank(b);
          if (rankDiff !== 0) return rankDiff;
          return contentWeight(b) - contentWeight(a);
        });

        spotlight.innerHTML = renderSpotlight(sortedEntries.slice(0, 4));

        var wallEntries = sortedEntries.length > 4 ? sortedEntries.slice(4) : sortedEntries;
        var richWall = [];
        var thinWall = [];
        wallEntries.forEach(function (entry) {
          if (richnessRank(entry) <= 1) {
            richWall.push(entry);
          } else {
            thinWall.push(entry);
          }
        });

        var html = "";
        if (richWall.length) {
          html +=
            '<div class="jyoti-gallery-masonry-block">' +
            richWall.map(renderStoryCard).join("") +
            "</div>";
        }
        if (thinWall.length) {
          html +=
            '<div class="jyoti-gallery-masonry-divider"><span>More patient smiles</span></div>' +
            '<div class="jyoti-gallery-masonry-block jyoti-gallery-masonry-block--compact">' +
            thinWall.map(renderStoryCard).join("") +
            "</div>";
        }
        grid.innerHTML = html;
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
