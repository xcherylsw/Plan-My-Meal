// Fills the ad slots on the content pages — only when AdSense details have
// been entered in site.config.json. With nothing entered, this does nothing.
(function () {
  var c = window.PMM_ADS || {};
  if (!c.publisherId || !c.contentSlot) return;
  var s = document.createElement("script");
  s.async = true; s.crossOrigin = "anonymous";
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(c.publisherId);
  document.head.appendChild(s);
  document.querySelectorAll(".ad-slot").forEach(function (el) {
    el.innerHTML = '<div class="lbl">Advertisement</div>' +
      '<ins class="adsbygoogle" style="display:block" data-ad-client="' + c.publisherId + '" data-ad-slot="' + c.contentSlot +
      '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  });
})();
