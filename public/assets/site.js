(function () {
  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Remember first-touch UTM parameters for the lead form.
  var utm = '';
  try {
    var params = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid'];
    var found = keys.filter(function (k) { return params.get(k); }).map(function (k) { return k + '=' + params.get(k); });
    if (found.length) sessionStorage.setItem('agt_utm', found.join('&'));
    utm = sessionStorage.getItem('agt_utm') || '';
    if (!utm && document.referrer && document.referrer.indexOf(location.host) === -1) utm = 'referrer=' + document.referrer;
  } catch (e) { /* storage blocked */ }

  var today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    form.elements.ts.value = String(Date.now());
    form.elements.utm.value = utm.slice(0, 500);
    form.elements.source_page.value = location.pathname;
    var depart = form.elements.depart_date;
    var ret = form.elements.return_date;
    depart.min = today;
    ret.min = today;
    depart.addEventListener('change', function () { ret.min = depart.value || today; });
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      setTimeout(function () { btn.disabled = false; btn.textContent = 'Get my group quote'; }, 8000);
    });
  });
})();
