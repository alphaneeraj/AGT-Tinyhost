/* AGT admin portal – vanilla JS single page app. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmt = function (iso) { return iso ? new Date(iso).toLocaleString() : '—'; };
  var STATUSES = ['new', 'contacted', 'quoted', 'booked', 'closed', 'spam'];

  var status = {};      // last /status response
  var listType = 'blog';
  var editing = null;   // post being edited (null = new)
  var quill = null;
  var dirty = false;

  // ---- api -----------------------------------------------------------------

  function api(method, url, body, headers) {
    var opts = { method: method, headers: Object.assign({ 'X-AGT-Admin': '1' }, headers || {}), credentials: 'same-origin' };
    if (body !== undefined) {
      if (body instanceof Blob) {
        opts.body = body;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    return fetch('/admin/api' + url, opts).then(function (res) {
      if (res.status === 401) { showLogin(); throw new Error('Please sign in again.'); }
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
        return data;
      });
    });
  }

  function toast(text, isError) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast' + (isError ? ' toast--error' : '');
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  // ---- auth ----------------------------------------------------------------

  function showLogin() {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    $('#login-error').textContent = '';
    fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: f.username.value, password: f.password.value }),
    }).then(function (res) {
      return res.json().then(function (d) {
        if (!res.ok) throw new Error(d.error || 'Sign in failed');
        f.password.value = '';
        boot();
      });
    }).catch(function (err) { $('#login-error').textContent = err.message; });
  });

  $('#logout').addEventListener('click', function () {
    fetch('/admin/logout', { method: 'POST' }).then(showLogin);
  });

  function boot() {
    api('GET', '/me').then(function () {
      $('#login-view').hidden = true;
      $('#app-view').hidden = false;
      refreshStatus();
      route();
    }).catch(function () {});
  }

  // ---- routing -------------------------------------------------------------

  function show(view) {
    $$('[data-view]').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== view; });
  }

  function setNav(name) {
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === name); });
  }

  function route() {
    var hash = location.hash.replace(/^#/, '') || 'dashboard';
    var parts = hash.split('/');
    if (parts[0] === 'blog' || parts[0] === 'flight') {
      listType = parts[0];
      setNav(listType);
      if (parts[1] === 'new') return openEditor(null);
      if (parts[1]) return openEditor(Number(parts[1]));
      return loadList();
    }
    setNav(parts[0]);
    if (parts[0] === 'leads') { show('leads'); return loadLeads(); }
    if (parts[0] === 'publish') { show('publish'); return refreshStatus(); }
    show('dashboard');
    loadDashboard();
  }

  window.addEventListener('hashchange', function () {
    if (dirty && !confirm('You have unsaved changes. Leave this page?')) return;
    dirty = false;
    route();
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---- status / dashboard ----------------------------------------------------

  function refreshStatus() {
    return api('GET', '/status').then(function (s) {
      status = s;
      $('#live-link').href = s.siteUrl + '/';
      var badge = $('#new-leads-badge');
      badge.hidden = !s.leads.new;
      badge.textContent = s.leads.new;
      var b = s.lastBuild || {};
      var p = s.lastPublish;
      $('#publish-status').innerHTML =
        '<dt>Live site</dt><dd><a href="' + esc(s.siteUrl) + '/">' + esc(s.siteUrl) + '</a></dd>' +
        '<dt>srht.site domain</dt><dd>' + esc(s.srhtDomain) + '</dd>' +
        '<dt>Publish token</dt><dd>' + (s.publishConfigured ? '✅ configured' : '⚠️ SRHT_TOKEN missing in .env') + '</dd>' +
        '<dt>Auto-publish on save</dt><dd>' + (s.autoPublish ? 'On' : 'Off') + '</dd>' +
        '<dt>Last build</dt><dd>' + (b.builtAt ? fmt(b.builtAt) + ' · ' + b.sitemapUrls + ' URLs in sitemap · ' + b.ms + ' ms' : '—') + '</dd>' +
        '<dt>Last publish</dt><dd>' + (p ? (p.ok ? '✅ ' + fmt(p.at) : '❌ ' + esc(p.error)) : 'Not published this session') + '</dd>';
      $('#site-status').innerHTML = $('#publish-status').innerHTML +
        '<dt>Lead form posts to</dt><dd><code>' + esc(s.leadEndpoint) + '</code></dd>';
      return s;
    });
  }

  function loadDashboard() {
    refreshStatus().then(function (s) {
      var c = s.counts;
      $('#stats').innerHTML = [
        ['New leads', s.leads.new, '#leads'],
        ['Leads (7 days)', s.leads.last7Days, '#leads'],
        ['Total leads', s.leads.total, '#leads'],
        ['Blog posts', c.blogPublished + ' <small>/ ' + c.blogTotal + '</small>', '#blog'],
        ['Flight pages', c.flightPublished + ' <small>/ ' + c.flightTotal + '</small>', '#flight'],
      ].map(function (x) {
        return '<a class="stat" href="' + x[2] + '"><span>' + x[0] + '</span><strong>' + x[1] + '</strong></a>';
      }).join('');
    });
    api('GET', '/leads').then(function (list) {
      $('#dash-leads').innerHTML = list.length ? leadTable(list.slice(0, 5), true) : '<p class="muted">No leads yet.</p>';
    });
  }

  // ---- leads -----------------------------------------------------------------

  function leadTable(list, compact) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Received</th><th>Name</th><th>Contact</th><th>Trip</th><th>Group</th><th>Status</th>' +
      (compact ? '' : '<th></th>') + '</tr></thead><tbody>' +
      list.map(function (l) {
        return '<tr class="lead-row' + (l.status === 'new' ? ' is-new' : '') + '" data-id="' + l.id + '">' +
          '<td>' + fmt(l.created_at) + '</td>' +
          '<td><strong>' + esc(l.name) + '</strong></td>' +
          '<td><a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a><br /><a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></td>' +
          '<td>' + esc(l.from_city) + ' → ' + esc(l.to_city) + '<br /><small>' + esc(l.depart_date) + (l.return_date ? ' – ' + esc(l.return_date) : '') + ' · ' + esc(l.trip_type) + '</small></td>' +
          '<td>' + esc(l.passengers) + '<br /><small>' + esc(l.cabin) + '</small></td>' +
          '<td>' + (compact ? '<span class="pill pill--' + l.status + '">' + l.status + '</span>'
            : '<select class="lead-status" data-id="' + l.id + '">' + STATUSES.map(function (s) {
              return '<option' + (s === l.status ? ' selected' : '') + '>' + s + '</option>';
            }).join('') + '</select>') + '</td>' +
          (compact ? '' : '<td><button class="link lead-more" data-id="' + l.id + '">Details</button></td>') +
          '</tr>' +
          (compact ? '' : '<tr class="lead-detail" data-for="' + l.id + '" hidden><td colspan="7">' +
            '<div class="lead-detail__grid">' +
            '<div><h4>Message</h4><p>' + (esc(l.message) || '<span class="muted">—</span>') + '</p>' +
            '<h4>Source</h4><p>Page: <code>' + esc(l.source_page) + '</code><br />UTM: <code>' + (esc(l.utm) || '—') + '</code><br />IP: ' + esc(l.ip) + '</p></div>' +
            '<div><h4>Internal notes</h4><textarea class="lead-notes" data-id="' + l.id + '" rows="4">' + esc(l.notes) + '</textarea>' +
            '<div class="row"><button class="btn lead-save" data-id="' + l.id + '">Save notes</button>' +
            '<button class="btn btn--danger lead-delete" data-id="' + l.id + '">Delete lead</button></div></div>' +
            '</div></td></tr>');
      }).join('') + '</tbody></table></div>';
  }

  function loadLeads() {
    var q = encodeURIComponent($('#lead-search').value.trim());
    var st = $('#lead-status').value;
    $('#lead-csv').href = '/admin/api/leads.csv' + (st ? '?status=' + st : '');
    api('GET', '/leads?status=' + st + '&q=' + q).then(function (list) {
      $('#lead-list').innerHTML = list.length ? leadTable(list, false) : '<p class="empty">No leads match.</p>';
    });
  }

  var searchTimer;
  $('#lead-search').addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(loadLeads, 250); });
  $('#lead-status').addEventListener('change', loadLeads);

  $('#lead-list').addEventListener('click', function (e) {
    var t = e.target;
    var id = t.getAttribute('data-id');
    if (t.classList.contains('lead-more')) {
      var row = $('.lead-detail[data-for="' + id + '"]');
      row.hidden = !row.hidden;
      t.textContent = row.hidden ? 'Details' : 'Hide';
    } else if (t.classList.contains('lead-save')) {
      api('PATCH', '/leads/' + id, { notes: $('.lead-notes[data-id="' + id + '"]').value })
        .then(function () { toast('Notes saved'); })
        .catch(function (err) { toast(err.message, true); });
    } else if (t.classList.contains('lead-delete')) {
      if (!confirm('Delete this lead permanently?')) return;
      api('DELETE', '/leads/' + id).then(function () { toast('Lead deleted'); loadLeads(); refreshStatus(); })
        .catch(function (err) { toast(err.message, true); });
    }
  });

  $('#lead-list').addEventListener('change', function (e) {
    if (!e.target.classList.contains('lead-status')) return;
    var id = e.target.getAttribute('data-id');
    api('PATCH', '/leads/' + id, { status: e.target.value }).then(function () {
      toast('Status updated');
      e.target.closest('tr').classList.toggle('is-new', e.target.value === 'new');
      refreshStatus();
    }).catch(function (err) { toast(err.message, true); });
  });

  // Poll for new leads every minute.
  setInterval(function () {
    if ($('#app-view').hidden) return;
    var before = status.leads ? status.leads.total : null;
    refreshStatus().then(function (s) {
      if (before !== null && s.leads.total > before) {
        toast('New lead received!');
        if (location.hash === '#leads') loadLeads();
      }
    }).catch(function () {});
  }, 60000);

  // ---- post list -------------------------------------------------------------

  var label = function (type) { return type === 'blog' ? 'Blog posts' : 'Flight pages'; };
  var pagePath = function (p) { return (p.type === 'blog' ? '/blog/' : '/flights/') + p.slug + '/'; };

  function loadList() {
    show('list');
    $('#list-title').textContent = label(listType);
    $('#new-post').textContent = listType === 'blog' ? '+ New blog post' : '+ New flight page';
    api('GET', '/posts?type=' + listType + '&status=' + $('#list-status').value).then(function (list) {
      if (!list.length) {
        $('#post-list').innerHTML = '<p class="empty">Nothing here yet. Click “New” to create your first ' + (listType === 'blog' ? 'blog post' : 'flight page') + '.</p>';
        return;
      }
      $('#post-list').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Title</th>' +
        (listType === 'flight' ? '<th>Route</th>' : '') + '<th>Status</th><th>Published</th><th>Updated</th><th>Words</th><th></th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr><td><a href="#' + listType + '/' + p.id + '"><strong>' + esc(p.title) + '</strong></a><br /><small class="muted">' + esc(pagePath(p)) + '</small></td>' +
            (listType === 'flight' ? '<td>' + esc(p.airline) + '<br /><small>' + esc(p.origin) + (p.destination ? ' → ' + esc(p.destination) : '') + '</small></td>' : '') +
            '<td><span class="pill pill--' + p.status + '">' + p.status + '</span></td>' +
            '<td>' + fmt(p.published_at) + '</td><td>' + fmt(p.updated_at) + '</td><td>' + p.words + '</td>' +
            '<td class="actions"><a href="#' + listType + '/' + p.id + '">Edit</a>' +
            (p.status === 'published' ? ' · <a href="' + pagePath(p) + '" target="_blank" rel="noopener">View</a>' : '') +
            ' · <button class="link danger post-delete" data-id="' + p.id + '" data-title="' + esc(p.title) + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    });
  }

  $('#list-status').addEventListener('change', loadList);
  $('#new-post').addEventListener('click', function () { location.hash = listType + '/new'; });
  $('#post-list').addEventListener('click', function (e) {
    if (!e.target.classList.contains('post-delete')) return;
    if (!confirm('Delete “' + e.target.getAttribute('data-title') + '”? The page will be removed from the site and sitemap.')) return;
    api('DELETE', '/posts/' + e.target.getAttribute('data-id')).then(function () {
      toast('Deleted – site rebuilt');
      loadList();
    }).catch(function (err) { toast(err.message, true); });
  });

  // ---- editor ----------------------------------------------------------------

  function initQuill() {
    if (quill) return;
    quill = new Quill('#quill', {
      theme: 'snow',
      placeholder: 'Write your content…',
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, 4, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
            [{ align: [] }],
            ['blockquote', 'code-block'],
            ['link', 'image', 'video'],
            ['clean'],
          ],
          handlers: { image: insertImage },
        },
      },
    });
    quill.on('text-change', function (delta, old, source) { if (source === 'user') dirty = true; });
  }

  function insertImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
    input.onchange = function () {
      if (!input.files[0]) return;
      upload(input.files[0]).then(function (url) {
        var range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', url, 'user');
        quill.setSelection(range.index + 1);
      });
    };
    input.click();
  }

  function upload(file) {
    toast('Uploading ' + file.name + '…');
    return api('POST', '/upload', file, { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) })
      .then(function (r) { toast('Image uploaded'); return r.url; })
      .catch(function (err) { toast(err.message, true); throw err; });
  }

  var form = $('#editor-form');
  var field = function (name) { return form.elements[name]; };

  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function slugify(t) {
    return String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  }

  function openEditor(id) {
    show('editor');
    initQuill();
    exitHtmlMode();
    form.reset();
    $('#editor-msg').textContent = '';
    $('#faq-list').innerHTML = '';
    $$('[data-only]').forEach(function (el) { el.hidden = el.getAttribute('data-only') !== listType; });
    var load = id ? api('GET', '/posts/' + id) : Promise.resolve(null);
    load.then(function (post) {
      editing = post;
      var noun = listType === 'blog' ? 'blog post' : 'flight page';
      $('#editor-title').textContent = post ? 'Edit ' + noun : 'New ' + noun;
      ['title', 'slug', 'author', 'tags', 'airline', 'origin', 'destination', 'price_from', 'cover_image', 'cover_alt', 'meta_title', 'meta_description', 'excerpt']
        .forEach(function (k) { field(k).value = post ? post[k] || '' : ''; });
      field('published_at').value = post ? toLocalInput(post.published_at) : '';
      quill.setContents([]);
      if (post && post.content_html) quill.clipboard.dangerouslyPasteHTML(post.content_html, 'silent');
      var faqs = [];
      try { faqs = JSON.parse((post && post.faqs) || '[]'); } catch (e) { /* ignore */ }
      faqs.forEach(addFaq);
      $('#status-label').textContent = post ? post.status : 'draft';
      var view = $('#editor-view');
      view.hidden = !(post && post.status === 'published');
      if (post) { view.href = pagePath(post); view.target = '_blank'; }
      updateMeta();
      dirty = false;
    }).catch(function (err) { toast(err.message, true); });
  }

  function addFaq(f) {
    var row = document.createElement('div');
    row.className = 'faq-row';
    row.innerHTML = '<input class="faq-q" placeholder="Question" maxlength="300" value="' + esc(f && f.q) + '" />' +
      '<textarea class="faq-a" rows="2" placeholder="Answer" maxlength="2000">' + esc(f && f.a) + '</textarea>' +
      '<button type="button" class="link danger faq-remove">Remove</button>';
    $('#faq-list').appendChild(row);
  }
  $('#faq-add').addEventListener('click', function () { addFaq(); dirty = true; });
  $('#faq-list').addEventListener('click', function (e) {
    if (e.target.classList.contains('faq-remove')) { e.target.parentNode.remove(); dirty = true; }
  });

  // HTML source mode
  function exitHtmlMode() {
    var src = $('#html-source');
    if (!src.hidden && quill) quill.clipboard.dangerouslyPasteHTML(src.value, 'user');
    src.hidden = true;
    if (quill) quill.getModule('toolbar').container.hidden = false;
    $('#quill').hidden = false;
    $('#html-toggle').textContent = 'Edit HTML';
  }
  $('#html-toggle').addEventListener('click', function () {
    var src = $('#html-source');
    if (src.hidden) {
      src.value = quill.getSemanticHTML().replace(/&nbsp;/g, ' ');
      src.hidden = false;
      $('#quill').hidden = true;
      quill.getModule('toolbar').container.hidden = true;
      this.textContent = 'Back to visual editor';
    } else {
      exitHtmlMode();
    }
  });

  function contentHtml() {
    var src = $('#html-source');
    // getSemanticHTML() turns Quill's internal <ol data-list="bullet"> markup into real <ul>/<ol>,
    // but Quill 2.0.x also turns every space into &nbsp;, which breaks line wrapping on the site.
    var html = src.hidden ? quill.getSemanticHTML().replace(/&nbsp;/g, ' ') : src.value;
    return /^(<p>(<br>)?<\/p>)?$/.test(html.trim()) ? '' : html;
  }

  // SEO helpers
  function updateMeta() {
    var title = field('title').value.trim();
    var slug = field('slug').value.trim() || slugify(title);
    var base = listType === 'blog' ? '/blog/' : '/flights/';
    $('#slug-preview').textContent = slug ? base + slug + '/' : '';
    $$('.count').forEach(function (c) {
      var len = field(c.getAttribute('data-for')).value.length;
      var max = Number(c.getAttribute('data-max'));
      c.textContent = len + '/' + max;
      c.classList.toggle('over', len > max);
    });
    var metaTitle = field('meta_title').value.trim() || (title ? title + ' | Airlines Group Travel' : 'Page title');
    var text = quill ? quill.getText().replace(/\s+/g, ' ').trim() : '';
    var desc = field('meta_description').value.trim() || field('excerpt').value.trim() || text.slice(0, 158);
    $('#serp-url').textContent = (status.siteUrl || '').replace(/^https?:\/\//, '') + base + (slug || '…') + '/';
    $('#serp-title').textContent = metaTitle.length > 62 ? metaTitle.slice(0, 60) + '…' : metaTitle;
    $('#serp-desc').textContent = desc.length > 160 ? desc.slice(0, 158) + '…' : desc;
    var cover = field('cover_image').value.trim();
    $('#cover-preview').innerHTML = cover ? '<img src="' + esc(cover) + '" alt="" />' : '';
  }
  form.addEventListener('input', function () { dirty = true; updateMeta(); });

  $('#cover-file').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    upload(file).then(function (url) {
      field('cover_image').value = url;
      if (!field('cover_alt').value) field('cover_alt').value = field('title').value;
      dirty = true;
      updateMeta();
    });
    this.value = '';
  });

  $('#editor-back').addEventListener('click', function () { location.hash = listType; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var targetStatus = (e.submitter && e.submitter.getAttribute('data-status')) || 'draft';
    if (!field('title').value.trim()) { toast('Title is required', true); field('title').focus(); return; }
    var faqs = $$('.faq-row', $('#faq-list')).map(function (row) {
      return { q: $('.faq-q', row).value.trim(), a: $('.faq-a', row).value.trim() };
    }).filter(function (f) { return f.q && f.a; });
    var publishedAt = field('published_at').value;
    var body = {
      type: listType,
      status: targetStatus,
      title: field('title').value,
      slug: field('slug').value,
      content_html: contentHtml(),
      published_at: publishedAt ? new Date(publishedAt).toISOString() : '',
      faqs: faqs,
    };
    ['author', 'tags', 'airline', 'origin', 'destination', 'price_from', 'cover_image', 'cover_alt', 'meta_title', 'meta_description', 'excerpt']
      .forEach(function (k) { body[k] = field(k).value; });
    if (targetStatus === 'published' && !body.content_html) { toast('Add some content before publishing', true); return; }

    var req = editing ? api('PUT', '/posts/' + editing.id, body) : api('POST', '/posts', body);
    req.then(function (r) {
      dirty = false;
      var built = r.build && !r.build.error;
      var msg = (targetStatus === 'published' ? 'Published' : 'Draft saved') + (built ? ' · site rebuilt, sitemap updated' : '');
      if (r.build && r.build.error) msg += ' · build error: ' + r.build.error;
      toast(msg, !!(r.build && r.build.error));
      $('#editor-msg').textContent = msg + ' (' + new Date().toLocaleTimeString() + ')';
      if (!editing) {
        // Switch the URL to the saved post without re-triggering the editor load.
        editing = r.post;
        history.replaceState(null, '', '#' + listType + '/' + r.post.id);
      }
      editing = r.post;
      field('slug').value = r.post.slug;
      field('published_at').value = toLocalInput(r.post.published_at);
      $('#status-label').textContent = r.post.status;
      var view = $('#editor-view');
      view.hidden = r.post.status !== 'published';
      view.href = pagePath(r.post);
      view.target = '_blank';
      $('#editor-title').textContent = 'Edit ' + (listType === 'blog' ? 'blog post' : 'flight page');
      updateMeta();
      refreshStatus();
    }).catch(function (err) { toast(err.message, true); $('#editor-msg').textContent = err.message; });
  });

  // ---- build & publish -------------------------------------------------------

  $('#btn-build').addEventListener('click', function () {
    api('POST', '/build').then(function (r) {
      $('#publish-msg').textContent = 'Built ' + r.sitemapUrls + ' URLs in ' + r.ms + ' ms.';
      refreshStatus();
    }).catch(function (err) { $('#publish-msg').textContent = err.message; });
  });

  $('#btn-publish').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    $('#publish-msg').textContent = 'Publishing to srht.site…';
    api('POST', '/publish').then(function (r) {
      $('#publish-msg').textContent = '✅ Published to ' + r.url + ' (' + r.method + ')';
      refreshStatus();
    }).catch(function (err) {
      $('#publish-msg').textContent = '❌ ' + err.message;
      refreshStatus();
    }).finally(function () { btn.disabled = false; });
  });

  boot();
})();
