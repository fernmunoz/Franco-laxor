/* ============================================================
   Franco läxor – delad app-motor
   En läxsida skriver bara sin egen lista av "kort" (frågor, ord,
   texter osv) och kallar SwipeHomework.init({...}). Motorn sköter
   svep-navigering, sparande, rättning och sammanfattning.
   ============================================================ */

(function (global) {
  "use strict";

  var REGISTRY_KEY = "francoLaxorRegistry";
  var DEFAULT_STUDENT_NAME = "Franco";
  var reduceMotion = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function todayStr() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getPath(obj, path) {
    var parts = path.split(".");
    var v = obj;
    for (var i = 0; i < parts.length; i++) v = v == null ? undefined : v[parts[i]];
    return v;
  }
  function setPath(obj, path, value) {
    var parts = path.split(".");
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }

  function initHomework(config) {
    var HOME_CARDS = config.cards || [];
    var HOME_TOTAL = HOME_CARDS.length;
    var CARDS = HOME_CARDS;
    var TOTAL = HOME_TOTAL;
    var inRetry = false;
    var STORAGE_KEY = config.storageKey || ("laxa-" + (config.title || "okand"));
    var mount = typeof config.mount === "string" ? document.querySelector(config.mount) : (config.mount || document.body);

    mount.classList.add("app-shell");
    document.title = config.title ? config.title + (config.subtitle ? " – " + config.subtitle : "") : document.title;

    var state = { currentIndex: 0 };
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) state = Object.assign(state, JSON.parse(saved));
    } catch (e) { /* no storage available, start fresh in memory */ }

    // Namn och datum är kända i förväg, ingen anledning att fråga om dem.
    if (!state.name) state.name = config.studentName || DEFAULT_STUDENT_NAME;
    if (!state.date) state.date = todayStr();

    // homeState pekar alltid på den riktiga läxans svar. En repetitionsrunda
    // (bara frågorna man svarade fel på) kör på en egen tillfällig state och
    // ska aldrig skriva över den riktiga, därav inRetry-spärren i persist().
    var homeState = state;

    // Tillfälligt UI-läge för vändbara (flip) kort: vilka som är uppfällda
    // just nu. Sparas inte, det är bara "har jag tryckt visa facit", inte
    // ett svar i sig.
    var revealedKeys = {};

    function persist() {
      if (inRetry) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        var reg = {};
        try { reg = JSON.parse(localStorage.getItem(REGISTRY_KEY) || "{}"); } catch (e2) {}
        reg[STORAGE_KEY] = {
          title: config.title || "",
          current: state.currentIndex + 1,
          total: TOTAL,
          done: state.currentIndex === TOTAL - 1,
          updatedAt: Date.now()
        };
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
      } catch (e) { /* ignore */ }
    }

    // ---- build app shell markup ----
    mount.innerHTML =
      '<div class="app-header">' +
      (config.backHref ? '<a class="back-link" href="' + esc(config.backHref) + '" aria-label="Tillbaka">‹</a>' : "") +
      '<svg class="compass" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="20" cy="20" r="17" stroke="var(--navy)" stroke-width="1.6"/>' +
      '<path d="M20 6 L23.5 18 L20 34 L16.5 18 Z" fill="var(--brass)"/>' +
      '<path d="M20 6 L23.5 18 L20 20 Z" fill="var(--navy)"/>' +
      '<circle cx="20" cy="20" r="2" fill="var(--navy)"/></svg>' +
      '<div class="app-title">' + esc(config.title || "") + (config.subtitle ? "<small>" + esc(config.subtitle) + "</small>" : "") + "</div>" +
      "</div>" +
      '<div class="progress-wrap"><div class="progress-track"><div class="progress-fill" id="progressFill"></div></div><div class="progress-label" id="progressLabel"></div></div>' +
      '<div class="card-stage" id="cardStage"><div class="card" id="card"></div></div>' +
      '<div class="nav-bar"><button class="nav-btn" id="prevBtn" aria-label="Föregående">‹</button><div class="nav-hint" id="navHint">Svep för att byta fråga</div><button class="nav-btn" id="nextBtn" aria-label="Nästa">›</button></div>';

    var cardEl = document.getElementById("card");
    var progressFill = document.getElementById("progressFill");
    var progressLabel = document.getElementById("progressLabel");
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    var navHint = document.getElementById("navHint");

    // ---- render each card type ----
    function renderCard(card) {
      switch (card.type) {
        case "intro": {
          var fields = (card.fields || [])
            .map(function (f) {
              return '<label class="field-label">' + esc(f.label) + '<input class="field-input" type="text" data-field-key="' + esc(f.key) + '" placeholder="' + esc(f.placeholder || "") + '" /></label>';
            })
            .join("");
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "Start") + "</div>" +
            '<h1 class="story-title">' + esc(card.title || "") + "</h1>" +
            (card.lead ? '<p class="lead">' + esc(card.lead) + "</p>" : "") +
            (fields ? '<div class="field-row">' + fields + "</div>" : "") +
            (card.hint ? '<p class="hint-text">' + esc(card.hint) + "</p>" : "")
          );
        }
        case "read":
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            (card.title ? '<h2 class="story-title" style="font-size:1.35rem">' + esc(card.title) + "</h2>" : "") +
            '<div class="story-text">' + (card.html || "") + "</div>" +
            (card.hint ? '<p class="hint-text">' + esc(card.hint) + "</p>" : "")
          );
        case "open":
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            '<p class="question-text">' + esc(card.question || "") + "</p>" +
            '<textarea class="field-textarea" data-field-key="' + esc(card.key) + '" rows="' + (card.rows || 6) + '" placeholder="' + esc(card.placeholder || "Skriv ditt svar här...") + '"></textarea>'
          );
        case "word":
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            '<p class="instruction">' + esc(card.instruction || "Skriv av ordet en gång:") + "</p>" +
            '<p class="big-word">' + esc(card.word) + "</p>" +
            '<input class="field-input center" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-field-key="' + esc(card.key) + '" data-check-word="' + esc(card.word) + '" placeholder="Skriv här" />' +
            '<p class="check-feedback" data-check-feedback></p>'
          );
        case "choice": {
          var selected = getPath(state, card.key);
          var btns = (card.options || [])
            .map(function (opt) {
              var cls = "choice-btn";
              var disabled = "";
              if (selected) {
                disabled = "disabled";
                if (opt === card.correct) cls += " is-correct";
                else if (opt === selected) cls += " is-wrong";
              }
              return '<button type="button" class="' + cls + '" data-choice-key="' + esc(card.key) + '" data-choice-value="' + esc(opt) + '" ' + disabled + ">" + esc(opt) + "</button>";
            })
            .join("");
          var fb = "";
          if (selected) fb = selected === card.correct ? (card.correctMsg || "Snyggt! Rätt svar.") : (card.wrongMsg || ("Nästan – rätt svar är " + card.correct + "."));
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            (card.prompt ? '<p class="instruction">' + esc(card.prompt) + "</p>" : "") +
            '<div class="choice-row">' + btns + "</div>" +
            '<p class="check-feedback">' + esc(fb) + "</p>"
          );
        }
        case "classify": {
          var sel = getPath(state, card.key);
          var tags = card.tags || [];
          var tagNames = card.tagNames || {};
          var tagBtns = tags
            .map(function (t) {
              var cls = "classify-btn";
              var disabled = "";
              if (sel) {
                disabled = "disabled";
                if (t === card.correct) cls += " is-correct";
                else if (t === sel) cls += " is-wrong";
              }
              return '<button type="button" class="' + cls + '" data-tag-key="' + esc(card.key) + '" data-tag-value="' + esc(t) + '" ' + disabled + ">" + esc(t) + "</button>";
            })
            .join("");
          var legendText = card.legend || tags.map(function (t) { return t + " = " + (tagNames[t] || t); }).join(" · ");
          var tfb = "";
          if (sel) {
            tfb = sel === card.correct
              ? "Rätt! " + esc(card.subject) + " är " + esc(tagNames[card.correct] || card.correct) + "."
              : "Rätt svar: " + esc(tagNames[card.correct] || card.correct) + ".";
          }
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            '<p class="classify-legend">' + esc(legendText) + "</p>" +
            '<p class="big-word">' + esc(card.subject) + "</p>" +
            '<div class="classify-row">' + tagBtns + "</div>" +
            '<p class="classify-feedback">' + tfb + "</p>"
          );
        }
        case "flip": {
          var flipVal = getPath(state, card.key);
          var flipRevealed = !!revealedKeys[card.key] || !!flipVal;
          var flipBody;
          if (!flipRevealed) {
            flipBody = '<button type="button" class="btn" data-reveal-key="' + esc(card.key) + '">Visa facit</button>';
          } else {
            var answerHtml = card.answer
              ? '<p class="flip-answer">' + esc(card.answer) + "</p>"
              : '<p class="flip-answer flip-answer-hint">Kolla ' + esc(card.page || "boken") + " och jämför med ditt svar.</p>";
            var rateBtns = [
              { v: "kunde", label: "Jag kunde det ✓" },
              { v: "ova", label: "Behöver öva mer 🔁" }
            ]
              .map(function (r) {
                var cls = "choice-btn";
                var disabled = "";
                if (flipVal) {
                  disabled = "disabled";
                  if (r.v === "kunde") cls += " is-correct";
                  else if (r.v === flipVal) cls += " is-wrong";
                }
                return '<button type="button" class="' + cls + '" data-choice-key="' + esc(card.key) + '" data-choice-value="' + r.v + '" ' + disabled + ">" + esc(r.label) + "</button>";
              })
              .join("");
            flipBody = answerHtml + '<div class="choice-row">' + rateBtns + "</div>";
          }
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            (card.page ? '<p class="flip-page">' + esc(card.page) + "</p>" : "") +
            '<p class="question-text">' + esc(card.question || "") + "</p>" +
            flipBody
          );
        }
        case "long":
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            (card.prompt ? '<p class="instruction">' + esc(card.prompt) + "</p>" : "") +
            '<textarea class="field-textarea" data-field-key="' + esc(card.key) + '" rows="' + (card.rows || 8) + '" placeholder="' + esc(card.placeholder || "Skriv här...") + '"></textarea>' +
            (card.minSentences ? '<p class="counter-text" data-sentence-counter data-min-sentences="' + card.minSentences + '"></p>' : "")
          );
        case "checklist": {
          var items = (card.items || [])
            .map(function (label, i) {
              return '<label class="check-item"><input type="checkbox" data-checklist-key="' + esc(card.key) + '" data-checklist-index="' + i + '" /><span>' + esc(label) + "</span></label>";
            })
            .join("");
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "") + "</div>" +
            (card.prompt ? '<p class="instruction">' + esc(card.prompt) + "</p>" : "") +
            items
          );
        }
        case "summary": {
          var wrongCards = computeWrongCards(CARDS, state);
          var recapHtml = "";
          if (wrongCards.length > 0) {
            recapHtml =
              '<div class="wrong-recap">' +
              '<p class="wrong-recap-title">Att öva mer på (' + wrongCards.length + ")</p>" +
              '<ul class="wrong-recap-list">' +
              wrongCards.map(function (c) { return "<li>" + esc(wrongLine(c)) + "</li>"; }).join("") +
              "</ul></div>";
          } else if (card.retryRound) {
            recapHtml = '<p class="wrong-recap-ok">Snyggt, du hade rätt på allt i den här rundan! 🎉</p>';
          }
          var actionLabel = wrongCards.length > 0
            ? "Öva på de " + wrongCards.length + " du hade fel på"
            : (card.retryRound ? "Tillbaka till läxan" : "Börja om från början");
          return (
            '<div class="eyebrow">' + esc(card.eyebrow || "Klart!") + "</div>" +
            '<h2 class="story-title" style="font-size:1.4rem">' + esc(card.title || "Bra jobbat!") + "</h2>" +
            (card.lead ? '<p class="lead">' + esc(card.lead) + "</p>" : "") +
            recapHtml +
            '<div class="summary-actions">' +
            (card.buildSummary ? '<button type="button" class="btn" id="showSummaryBtn">Visa alla mina svar</button><button type="button" class="btn secondary" id="printBtn">Skriv ut</button>' : "") +
            '<button type="button" class="btn danger" id="actionBtn">' + esc(actionLabel) + "</button>" +
            "</div>" +
            (card.buildSummary ? '<textarea class="summary-box" id="summaryBox" style="display:none" readonly rows="14"></textarea>' : "") +
            (config.backHref ? '<a class="btn secondary" style="text-align:center;text-decoration:none;margin-top:0.3rem" href="' + esc(config.backHref) + '">Till läxlistan</a>' : "")
          );
        }
        default:
          return "";
      }
    }

    function updateSentenceCounter(el, textEl, min) {
      var text = textEl.value || "";
      var count = (text.match(/[.!?]+/g) || []).length;
      el.textContent = count + " av " + min + " meningar" + (count >= min ? " – snyggt! ✓" : "");
      el.classList.toggle("is-ready", count >= min);
    }

    function bindCard(index) {
      var card = CARDS[index];

      cardEl.querySelectorAll("[data-field-key]").forEach(function (el) {
        var key = el.getAttribute("data-field-key");
        el.value = getPath(state, key) || "";
        el.addEventListener("input", function () {
          setPath(state, key, el.value);
          persist();
          if (el.hasAttribute("data-check-word")) {
            var fb = cardEl.querySelector("[data-check-feedback]");
            var target = el.getAttribute("data-check-word").trim().toLowerCase();
            if (fb) fb.textContent = el.value.trim().toLowerCase() === target ? "✓ Snyggt skrivet!" : "";
          }
        });
      });

      if (card.type === "word") {
        var fb = cardEl.querySelector("[data-check-feedback]");
        var input = cardEl.querySelector("[data-check-word]");
        if (fb && input && input.value.trim().toLowerCase() === card.word.toLowerCase()) fb.textContent = "✓ Snyggt skrivet!";
      }

      if (card.type === "long") {
        var counter = cardEl.querySelector("[data-sentence-counter]");
        var ta = cardEl.querySelector("[data-field-key]");
        if (counter && ta) {
          var min = parseInt(counter.getAttribute("data-min-sentences"), 10) || 6;
          updateSentenceCounter(counter, ta, min);
          ta.addEventListener("input", function () { updateSentenceCounter(counter, ta, min); });
        }
      }

      cardEl.querySelectorAll("[data-reveal-key]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          revealedKeys[btn.getAttribute("data-reveal-key")] = true;
          showCard(index, { instant: true });
        });
      });

      cardEl.querySelectorAll("[data-checklist-key]").forEach(function (el) {
        var key = el.getAttribute("data-checklist-key");
        var i = parseInt(el.getAttribute("data-checklist-index"), 10);
        var arr = getPath(state, key) || [];
        el.checked = !!arr[i];
        el.addEventListener("change", function () {
          var current = getPath(state, key) || [];
          current[i] = el.checked;
          setPath(state, key, current);
          persist();
        });
      });

      cardEl.querySelectorAll("[data-choice-value]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setPath(state, btn.getAttribute("data-choice-key"), btn.getAttribute("data-choice-value"));
          persist();
          showCard(index, { instant: true });
        });
      });

      cardEl.querySelectorAll("[data-tag-value]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setPath(state, btn.getAttribute("data-tag-key"), btn.getAttribute("data-tag-value"));
          persist();
          showCard(index, { instant: true });
        });
      });

      if (card.type === "summary") {
        if (card.buildSummary) {
          var showBtn = document.getElementById("showSummaryBtn");
          var box = document.getElementById("summaryBox");
          showBtn.addEventListener("click", function () {
            box.value = card.buildSummary(state);
            box.style.display = box.style.display === "none" ? "block" : "none";
            if (box.style.display === "block") { box.focus(); box.select(); }
          });
          document.getElementById("printBtn").addEventListener("click", function () {
            box.value = card.buildSummary(state);
            box.style.display = "block";
            global.print();
          });
        }

        var wrongNow = computeWrongCards(CARDS, state);
        document.getElementById("actionBtn").addEventListener("click", function () {
          if (wrongNow.length > 0) {
            enterRetryRound(wrongNow);
          } else if (card.retryRound) {
            returnHome();
          } else if (confirm("Vill du börja om från början? Alla svar rensas.")) {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            CARDS = HOME_CARDS;
            TOTAL = HOME_TOTAL;
            inRetry = false;
            state = { currentIndex: 0 };
            homeState = state;
            showCard(0, { instant: true });
          }
        });
      }
    }

    // ---- navigation / swipe ----
    var isAnimating = false;
    var animTimer = null;

    // Frågor med facit (flerval, sortera) ska visa rätt/fel innan man går
    // vidare, annars missar man rättningen helt.
    function requiresAnswer(card) {
      return card && (card.type === "choice" || card.type === "classify" || card.type === "flip");
    }
    function isAnswered(card) {
      return !!getPath(state, card.key);
    }

    // Alla flervals-/sorteringskort är garanterat besvarade när man når
    // summeringen (goNext/svep tillåter inte att man hoppar över dem), så
    // det räcker att jämföra svaret mot facit.
    function computeWrongCards(cardsArr, st) {
      return cardsArr.filter(function (c) {
        return requiresAnswer(c) && getPath(st, c.key) !== c.correct;
      });
    }

    function wrongLine(card) {
      var val = getPath(state, card.key);
      if (card.type === "classify") {
        var tn = card.tagNames || {};
        return (card.subject || "") + " — du svarade " + (tn[val] || val) + ", rätt är " + (tn[card.correct] || card.correct);
      }
      if (card.type === "flip") {
        return (card.question || "") + (card.page ? " (" + card.page + ")" : "");
      }
      return (card.prompt || "") + " — du svarade " + val + ", rätt svar är " + card.correct;
    }

    function enterRetryRound(wrongCards) {
      var cloned = wrongCards.map(function (c, i) {
        var clone = Object.assign({}, c);
        clone.eyebrow = "Repetition · " + (i + 1) + " av " + wrongCards.length;
        return clone;
      });
      cloned.push({
        type: "summary",
        eyebrow: "Repetition klar",
        title: "Bra jobbat med repetitionen!",
        lead: "Här är läget efter den här rundan.",
        retryRound: true
      });
      CARDS = cloned;
      TOTAL = CARDS.length;
      inRetry = true;
      state = { currentIndex: 0 };
      showCard(0, { instant: true });
    }

    function returnHome() {
      CARDS = HOME_CARDS;
      TOTAL = HOME_TOTAL;
      inRetry = false;
      state = homeState;
      showCard(HOME_TOTAL - 1, { instant: true });
    }

    function nudge() {
      cardEl.style.opacity = "1";
      if (reduceMotion) {
        cardEl.style.transition = "none";
        cardEl.style.transform = "translateX(0) rotate(0deg)";
        return;
      }
      cardEl.style.transition = "transform 0.09s ease";
      cardEl.style.transform = "translateX(-10px) rotate(-2deg)";
      setTimeout(function () {
        cardEl.style.transform = "translateX(8px) rotate(2deg)";
        setTimeout(function () {
          cardEl.style.transform = "translateX(0) rotate(0deg)";
        }, 90);
      }, 90);
    }

    function showCard(index, opts) {
      index = Math.max(0, Math.min(TOTAL - 1, index));
      opts = opts || {};
      if (index === state.currentIndex && !opts.instant) return;
      var direction = opts.direction || 0;

      function paint() {
        cardEl.innerHTML = renderCard(CARDS[index]);
        bindCard(index);
        state.currentIndex = index;
        persist();
        var blocked = requiresAnswer(CARDS[index]) && !isAnswered(CARDS[index]);
        progressFill.style.width = ((index + 1) / TOTAL) * 100 + "%";
        progressLabel.textContent = "Steg " + (index + 1) + " av " + TOTAL;
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === TOTAL - 1 || blocked;
        navHint.textContent = index === TOTAL - 1 ? "Klart!" : (blocked ? "Välj ett svar för att gå vidare" : "Svep för att byta fråga");
      }

      if (animTimer) { clearTimeout(animTimer); animTimer = null; }

      if (opts.instant || reduceMotion || direction === 0) {
        isAnimating = false;
        cardEl.style.transition = "none";
        cardEl.style.transform = "translateX(0) rotate(0deg)";
        cardEl.style.opacity = "1";
        paint();
        return;
      }

      isAnimating = true;
      cardEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
      cardEl.style.transform = "translateX(" + (direction * -60) + "px) rotate(" + (direction * -4) + "deg)";
      cardEl.style.opacity = "0";
      animTimer = setTimeout(function () {
        paint();
        cardEl.style.transition = "none";
        cardEl.style.transform = "translateX(" + (direction * 60) + "px) rotate(" + (direction * 4) + "deg)";
        cardEl.style.opacity = "0";
        requestAnimationFrame(function () {
          cardEl.style.transition = "transform 0.22s ease, opacity 0.22s ease";
          cardEl.style.transform = "translateX(0) rotate(0deg)";
          cardEl.style.opacity = "1";
          animTimer = setTimeout(function () { isAnimating = false; animTimer = null; }, 230);
        });
      }, 200);
    }

    function goNext() {
      if (state.currentIndex >= TOTAL - 1) return;
      var current = CARDS[state.currentIndex];
      if (requiresAnswer(current) && !isAnswered(current)) { nudge(); return; }
      showCard(state.currentIndex + 1, { direction: -1 });
    }
    function goPrev() { if (state.currentIndex > 0) showCard(state.currentIndex - 1, { direction: 1 }); }

    prevBtn.addEventListener("click", goPrev);
    nextBtn.addEventListener("click", goNext);
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    });

    var dragging = false, startX = 0, startY = 0, dx = 0, dy = 0, horizontal = false, pointerId = null;
    var DRAG_THRESHOLD = 10, SWIPE_THRESHOLD = 80;

    cardEl.addEventListener("pointerdown", function (e) {
      if (isAnimating) return;
      dragging = true; horizontal = false;
      startX = e.clientX; startY = e.clientY; dx = 0; dy = 0;
      pointerId = e.pointerId;
    });

    cardEl.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      if (!horizontal && Math.abs(dx) > DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
        cardEl.classList.add("dragging");
        try { cardEl.setPointerCapture(pointerId); } catch (err) {}
      }
      if (horizontal) {
        e.preventDefault();
        var rot = Math.max(-12, Math.min(12, dx / 12));
        cardEl.style.transform = "translateX(" + dx + "px) rotate(" + rot + "deg)";
        cardEl.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 400));
      }
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      cardEl.classList.remove("dragging");
      if (horizontal) {
        var current = CARDS[state.currentIndex];
        var blockedForward = requiresAnswer(current) && !isAnswered(current);
        if (dx <= -SWIPE_THRESHOLD && state.currentIndex < TOTAL - 1 && !blockedForward) {
          showCard(state.currentIndex + 1, { direction: -1 });
        } else if (dx >= SWIPE_THRESHOLD && state.currentIndex > 0) {
          showCard(state.currentIndex - 1, { direction: 1 });
        } else if (dx <= -SWIPE_THRESHOLD && blockedForward) {
          nudge();
        } else {
          cardEl.style.transition = "transform 0.25s ease, opacity 0.25s ease";
          cardEl.style.transform = "translateX(0) rotate(0deg)";
          cardEl.style.opacity = "1";
        }
      }
      horizontal = false;
    }
    cardEl.addEventListener("pointerup", endDrag);
    cardEl.addEventListener("pointercancel", endDrag);

    showCard(Math.min(state.currentIndex || 0, TOTAL - 1), { instant: true });
  }

  global.SwipeHomework = { init: initHomework };
})(window);
