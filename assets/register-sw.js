// Registrerar service workern (offline-cache) om webbläsaren stödjer det.
// Ligger i assets/ eftersom både startsidan och varje läxsida använder den.
if ("serviceWorker" in navigator) {
  // Sökvägen till roten skiljer sig mellan / och /laxor/, räkna ut den
  // utifrån var den här filen själv laddades ifrån (måste läsas synkront,
  // document.currentScript slutar gälla inne i en senare callback).
  var here = document.currentScript && document.currentScript.src;
  var root = here ? here.replace(/assets\/register-sw\.js.*$/, "") : "./";
  window.addEventListener("load", function () {
    navigator.serviceWorker.register(root + "service-worker.js").catch(function () {
      /* offline-stöd är trevligt att ha, inte kritiskt om det failar */
    });
  });
}
