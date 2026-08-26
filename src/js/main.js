/* =========================================================
   China Dental Travel — Frontend behaviour
   ========================================================= */
(function () {
  "use strict";

  /* ---- Mobile navigation toggle ---- */
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        nav.classList.toggle("open");
      });
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { nav.classList.remove("open"); });
      });
    }

    /* ---- FAQ accordion ---- */
    document.querySelectorAll(".faq-item button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.parentElement;
        var open = item.classList.toggle("open");
        btn.querySelector(".plus").textContent = open ? "−" : "+";
      });
    });

    /* ---- Lazy-load images (native) ---- */
    document.querySelectorAll("img[data-src]").forEach(function (img) {
      img.setAttribute("loading", "lazy");
    });

    /* ---- Anti-theft: disable right-click / drag on images only ---- */
    document.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      img.addEventListener("dragstart", function (e) { e.preventDefault(); });
    });
  });

  /* ---- Google Translate widget init ---- */
  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return;
    new google.translate.TranslateElement({
      pageLanguage: "en",
      includedLanguages: "zh-CN,en,es,ja,th,vi,ko,fr,de,ru,ar,pt",
      layout: google.translate.TranslateElement.InlineLayout.HORIZONTAL,
      autoDisplay: false
    }, "google_translate_element");
  };

  /* ---- Watermark baking utility (used by the admin / upload flow) ----
     Bakes "chinadentaltravel.com" into an uploaded image via canvas so
     the watermark travels with the file (server-side Worker also applies it). */
  window.bakeWatermark = function (file, text) {
    text = text || "chinadentaltravel.com";
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          var fontSize = Math.max(16, Math.round(canvas.width / 38));
          ctx.font = fontSize + "px Arial";
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.lineWidth = Math.max(1, fontSize / 12);
          ctx.textBaseline = "bottom";
          var pad = fontSize;
          // tiled diagonal watermark
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 6);
          var step = fontSize * 12;
          for (var y = -canvas.height; y < canvas.height; y += step) {
            for (var x = -canvas.width; x < canvas.width; x += step) {
              ctx.strokeText(text, x, y);
              ctx.fillText(text, x, y);
            }
          }
          ctx.restore();
          canvas.toBlob(function (blob) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          }, "image/jpeg", 0.92);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
})();
