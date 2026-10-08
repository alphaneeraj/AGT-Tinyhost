/* AGT live admin – a static page that saves posts to GitHub.
 * No server: every save is a commit; GitHub Actions rebuilds and deploys the site. */
(function () {
  'use strict';

  var S = window.AGT_SETTINGS || {};
  var GH_API = S.githubApi || 'https://api.github.com';
  var RAW = S.rawBase || ('https://raw.githubusercontent.com/' + S.repo + '/' + S.branch);
  var DIRS = { blog: 'content/blog', flight: 'content/flights' };
  var STORE = 'agt_admin_auth';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmt = function (iso) { return iso ? new Date(iso).toLocaleString() : '—'; };
  var nowIso = function () { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); };

  var auth = null;           // { token }
  var listType = 'blog';
  var postsCache = {};       // type -> [{ post, sha, path }]
  var editing = null;        // { post, sha, path } or null for new
  var quill = null;
  var dirty = false;

  // ---- storage ---------------------------------------------------------------

  function loadAuth() {
    try { return JSON.parse(localStorage.getItem(STORE) || sessionStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  function saveAuth(a, remember) {
    try {
      localStorage.removeItem(STORE);
      sessionStorage.removeItem(STORE);
      (remember ? localStorage : sessionStorage).setItem(STORE, JSON.stringify(a));
    } catch (e) { /* storage blocked: stays in memory for this tab */ }
  }

  // ---- utf-8 base64 ------------------------------------------------------------

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---- GitHub API ----------------------------------------------------------------

  function gh(method, path, body) {
    return fetch(GH_API + path, {
      method: method,
      headers: {
        Authorization: 'Bearer ' + auth.token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = text ? JSON.parse(text) : {};
        if (res.status === 401) { signOut(); throw new Error('GitHub token rejected – please sign in again.'); }
        if (!res.ok) {
          var err = new Error(data.message || ('GitHub error ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  var repoPath = function (p) { return '/repos/' + S.repo + '/contents/' + p; };

  function listPosts(type, force) {
    if (postsCache[type] && !force) return Promise.resolve(postsCache[type]);
    return gh('GET', repoPath(DIRS[type]) + '?ref=' + S.branch).catch(function (err) {
      if (err.status === 404) return [];
      throw err;
    }).then(function (files) {
      var jsonFiles = files.filter(function (f) { return /\.json$/.test(f.name); });
      // Fetch files a few at a time to stay friendly with the API.
      var out = [];
      var i = 0;
      function next() {
        if (i >= jsonFiles.length) return Promise.resolve();
        var batch = jsonFiles.slice(i, i + 6);
        i += 6;
        return Promise.all(batch.map(function (f) {
          return gh('GET', repoPath(f.path) + '?ref=' + S.branch).then(function (file) {
            var post = JSON.parse(b64decode(file.content));
            post.slug = post.slug || f.name.replace(/\.json$/, '');
            out.push({ post: post, sha: file.sha, path: f.path });
          });
        })).then(next);
      }
      return next().then(function () {
        out.sort(function (a, b) {
          return String(b.post.published_at || b.post.created_at || '').localeCompare(String(a.post.published_at || a.post.created_at || ''));
        });
        postsCache[type] = out;
        return out;
      });
    });
  }

  function putFile(path, base64, message, sha) {
    var body = { message: message, content: base64, branch: S.branch };
    if (sha) body.sha = sha;
    return gh('PUT', repoPath(path), body);
  }

  function deleteFile(path, sha, message) {
    return gh('DELETE', repoPath(path), { message: message, sha: sha, branch: S.branch });
  }

  // ---- UI helpers ------------------------------------------------------------------

  function toast(text, isError) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast' + (isError ? ' toast--error' : '');
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 4000);
  }

  function slugify(t) {
    return String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  }

  var siteLink = function (p) { return S.siteUrl + p; };
  var pagePath = function (type, slug) { return (type === 'blog' ? '/blog/' : '/flights/') + slug + '/'; };

  // Images live at /uploads/… on the site, but a fresh upload isn't deployed yet, so the editor
  // shows them from GitHub's raw file server and converts back when saving.
  var toEditorSrc = function (html) { return String(html || '').replace(/(src=")\/uploads\//g, '$1' + RAW + '/content/uploads/'); };
  var fromEditorSrc = function (html) { return String(html || '').split(RAW + '/content/uploads/').join('/uploads/'); };
  var previewSrc = function (src) { return /^\/uploads\//.test(src) ? RAW + '/content' + src : src; };

  // ---- auth ----------------------------------------------------------------------

  function showLogin(msg) {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-error').textContent = msg || '';
  }

  function signOut() {
    auth = null;
    try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    showLogin();
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var candidate = { token: f.token.value.trim() };
    auth = candidate;
    $('#login-error').textContent = 'Checking…';
    gh('GET', '/repos/' + S.repo).then(function () {
      saveAuth(candidate, f.remember.checked);
      f.token.value = '';
      start();
    }).catch(function (err) {
      auth = null;
      $('#login-error').textContent = err.status === 404
        ? 'This token cannot access ' + S.repo + '. Give it access to that repository.'
        : err.message;
    });
  });

  $('#logout').addEventListener('click', signOut);

  function start() {
    $('#login-error').textContent = '';
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#live-link').href = S.siteUrl + '/';
    route();
    refreshDeploys();
  }

  // ---- routing -------------------------------------------------------------------

  function show(view) { $$('[data-view]').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== view; }); }
  function setNav(name) { $$('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === name); }); }

  function route() {
    var parts = (location.hash.replace(/^#/, '') || 'dashboard').split('/');
    if (parts[0] === 'blog' || parts[0] === 'flight') {
      listType = parts[0];
      setNav(listType);
      if (parts[1] === 'new') return openEditor(null);
      if (parts[1]) return openEditor(decodeURIComponent(parts[1]));
      return loadList();
    }
    setNav(parts[0]);
    if (parts[0] === 'site') { show('site'); return loadSite(); }
    show('dashboard');
    loadDashboard();
  }

  window.addEventListener('hashchange', function () {
    if (dirty && !confirm('You have unsaved changes. Leave this page?')) return;
    dirty = false;
    route();
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---- deploy status ---------------------------------------------------------------

  var deployTimer = null;
  function refreshDeploys() {
    return gh('GET', '/repos/' + S.repo + '/actions/runs?per_page=8').then(function (d) {
      var runs = d.workflow_runs || [];
      var latest = runs[0];
      var pill = $('#deploy-pill');
      if (latest) {
        var busy = latest.status !== 'completed';
        var ok = latest.conclusion === 'success';
        pill.hidden = false;
        pill.className = 'deploy-pill ' + (busy ? 'is-busy' : ok ? 'is-ok' : 'is-bad');
        pill.textContent = busy ? 'Site updating…' : ok ? 'Site is up to date' : 'Last deploy failed';
        clearTimeout(deployTimer);
        if (busy) deployTimer = setTimeout(refreshDeploys, 10000);
      }
      return runs;
    }).catch(function () { return []; /* token may lack Actions:read – deploy status is optional */ });
  }

  function loadSite() {
    $('#site-status').innerHTML =
      '<dt>Live site</dt><dd><a href="' + esc(S.siteUrl) + '/" target="_blank" rel="noopener">' + esc(S.siteUrl) + '</a></dd>' +
      '<dt>Content repository</dt><dd><a href="https://github.com/' + esc(S.repo) + '" target="_blank" rel="noopener">' + esc(S.repo) + '</a> (' + esc(S.branch) + ')</dd>';
    $('#deploys').innerHTML = '<p class="muted">Loading…</p>';
    refreshDeploys().then(function (runs) {
      $('#deploys').innerHTML = runs.length
        ? '<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Change</th><th>Result</th></tr></thead><tbody>' +
          runs.map(function (r) {
            var res = r.status !== 'completed' ? '⏳ ' + r.status : r.conclusion === 'success' ? '✅ live' : '❌ ' + r.conclusion;
            return '<tr><td>' + fmt(r.created_at) + '</td><td>' + esc((r.head_commit && r.head_commit.message || r.display_title || '').split('\n')[0]) +
              '</td><td><a href="' + esc(r.html_url) + '" target="_blank" rel="noopener">' + res + '</a></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="muted">No deploy history visible (give the token “Actions: Read” to see it).</p>';
    });
  }

  // ---- dashboard -------------------------------------------------------------------

  function loadDashboard() {
    Promise.all([listPosts('blog'), listPosts('flight')]).then(function (r) {
      var pub = function (l) { return l.filter(function (x) { return x.post.status === 'published'; }).length; };
      $('#stats').innerHTML = [
        ['Blog posts', pub(r[0]) + ' <small>/ ' + r[0].length + '</small>', '#blog'],
        ['Flight pages', pub(r[1]) + ' <small>/ ' + r[1].length + '</small>', '#flight'],
        ['Write a blog post', '+', '#blog/new'],
        ['Add a flight page', '+', '#flight/new'],
      ].map(function (x) {
        return '<a class="stat" href="' + x[2] + '"><span>' + x[0] + '</span><strong>' + x[1] + '</strong></a>';
      }).join('');
    }).catch(function (err) { toast(err.message, true); });
  }

  // ---- post list -------------------------------------------------------------------

  var label = function (type) { return type === 'blog' ? 'Blog posts' : 'Flight pages'; };

  function loadList(force) {
    show('list');
    $('#list-title').textContent = label(listType);
    $('#new-post').textContent = listType === 'blog' ? '+ New blog post' : '+ New flight page';
    $('#post-list').innerHTML = '<p class="muted">Loading…</p>';
    listPosts(listType, force).then(function (list) {
      var st = $('#list-status').value;
      list = list.filter(function (x) { return !st || x.post.status === st; });
      if (!list.length) {
        $('#post-list').innerHTML = '<p class="empty">Nothing here yet. Click “New” to create your first ' + (listType === 'blog' ? 'blog post' : 'flight page') + '.</p>';
        return;
      }
      $('#post-list').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Title</th>' +
        (listType === 'flight' ? '<th>Route</th>' : '') + '<th>Status</th><th>Published</th><th>Updated</th><th></th></tr></thead><tbody>' +
        list.map(function (x) {
          var p = x.post;
          var scheduled = p.status === 'published' && p.published_at && new Date(p.published_at) > new Date();
          var edit = '#' + listType + '/' + encodeURIComponent(p.slug);
          return '<tr><td><a href="' + edit + '"><strong>' + esc(p.title) + '</strong></a><br /><small class="muted">' + esc(pagePath(listType, p.slug)) + '</small></td>' +
            (listType === 'flight' ? '<td>' + esc(p.airline) + '<br /><small>' + esc(p.origin) + (p.destination ? ' → ' + esc(p.destination) : '') + '</small></td>' : '') +
            '<td><span class="pill pill--' + (scheduled ? 'draft' : esc(p.status)) + '">' + (scheduled ? 'scheduled' : esc(p.status)) + '</span></td>' +
            '<td>' + fmt(p.published_at) + '</td><td>' + fmt(p.updated_at) + '</td>' +
            '<td class="actions"><a href="' + edit + '">Edit</a>' +
            (p.status === 'published' && !scheduled ? ' · <a href="' + esc(siteLink(pagePath(listType, p.slug))) + '" target="_blank" rel="noopener">View</a>' : '') +
            ' · <button class="link danger post-delete" data-slug="' + esc(p.slug) + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function (err) { $('#post-list').innerHTML = '<p class="error">' + esc(err.message) + '</p>'; });
  }

  $('#list-status').addEventListener('change', function () { loadList(); });
  $('#new-post').addEventListener('click', function () { location.hash = listType + '/new'; });
  $('#post-list').addEventListener('click', function (e) {
    if (!e.target.classList.contains('post-delete')) return;
    var slug = e.target.getAttribute('data-slug');
    var item = (postsCache[listType] || []).filter(function (x) { return x.post.slug === slug; })[0];
    if (!item || !confirm('Delete “' + item.post.title + '”? It will be removed from the site and sitemap.')) return;
    deleteFile(item.path, item.sha, 'Delete ' + listType + ': ' + item.post.title).then(function () {
      toast('Deleted – the site is rebuilding');
      postsCache[listType] = postsCache[listType].filter(function (x) { return x !== item; });
      loadList();
      setTimeout(refreshDeploys, 4000);
    }).catch(function (err) { toast(err.message, true); });
  });

  // ---- editor ----------------------------------------------------------------------

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
    quill.on('text-change', function (d, o, source) { if (source === 'user') { dirty = true; updateMeta(); } });
  }

  function upload(file) {
    var allowed = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
    if (!allowed[file.type]) return Promise.reject(new Error('Use a JPG, PNG, WebP, GIF or AVIF image.'));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Image is over 5 MB – please compress it first.'));
    toast('Uploading ' + file.name + '…');
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(new Error('Could not read the file')); };
      reader.readAsDataURL(file);
    }).then(function (b64) {
      var month = new Date().toISOString().slice(0, 7);
      var name = (slugify(file.name.replace(/\.[^.]+$/, '')) || 'image').slice(0, 50) + '-' + Math.random().toString(36).slice(2, 8) + allowed[file.type];
      var sitePath = '/uploads/' + month + '/' + name;
      return putFile('content' + sitePath, b64, 'Upload image ' + name).then(function () {
        toast('Image uploaded');
        return sitePath;
      });
    });
  }

  function insertImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
    input.onchange = function () {
      if (!input.files[0]) return;
      upload(input.files[0]).then(function (sitePath) {
        var range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', previewSrc(sitePath), 'user');
        quill.setSelection(range.index + 1);
      }).catch(function (err) { toast(err.message, true); });
    };
    input.click();
  }

  var form = $('#editor-form');
  var field = function (name) { return form.elements[name]; };
  var TEXT_FIELDS = ['title', 'slug', 'author', 'tags', 'airline', 'origin', 'destination', 'price_from', 'cover_image', 'cover_alt', 'meta_title', 'meta_description', 'excerpt'];

  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function openEditor(slug) {
    show('editor');
    initQuill();
    exitHtmlMode(false);
    form.reset();
    $('#editor-msg').textContent = '';
    $('#faq-list').innerHTML = '';
    $$('[data-only]').forEach(function (el) { el.hidden = el.getAttribute('data-only') !== listType; });
    var load = slug
      ? listPosts(listType).then(function (list) {
        var item = list.filter(function (x) { return x.post.slug === slug; })[0];
        if (!item) throw new Error('Post not found: ' + slug);
        return item;
      })
      : listPosts(listType).then(function () { return null; }); // loads existing slugs for the duplicate check
    load.then(function (item) {
      editing = item;
      var post = item ? item.post : null;
      var noun = listType === 'blog' ? 'blog post' : 'flight page';
      $('#editor-title').textContent = post ? 'Edit ' + noun : 'New ' + noun;
      TEXT_FIELDS.forEach(function (k) { field(k).value = post ? post[k] || '' : ''; });
      field('published_at').value = post ? toLocalInput(post.published_at) : '';
      quill.setContents([]);
      if (post && post.content_html) quill.clipboard.dangerouslyPasteHTML(toEditorSrc(post.content_html), 'silent');
      (post && Array.isArray(post.faqs) ? post.faqs : []).forEach(addFaq);
      $('#status-label').textContent = post ? post.status : 'draft';
      setViewLink(post);
      updateMeta();
      dirty = false;
    }).catch(function (err) { toast(err.message, true); });
  }

  function setViewLink(post) {
    var view = $('#editor-view');
    view.hidden = !(post && post.status === 'published');
    if (post) view.href = siteLink(pagePath(listType, post.slug));
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
  function exitHtmlMode(apply) {
    var src = $('#html-source');
    if (apply !== false && !src.hidden && quill) quill.clipboard.dangerouslyPasteHTML(toEditorSrc(src.value), 'user');
    src.hidden = true;
    if (quill) quill.getModule('toolbar').container.hidden = false;
    $('#quill').hidden = false;
    $('#html-toggle').textContent = 'Edit HTML';
  }
  $('#html-toggle').addEventListener('click', function () {
    var src = $('#html-source');
    if (src.hidden) {
      src.value = editorHtml();
      src.hidden = false;
      $('#quill').hidden = true;
      quill.getModule('toolbar').container.hidden = true;
      this.textContent = 'Back to visual editor';
    } else {
      exitHtmlMode();
    }
  });

  // getSemanticHTML() gives real <ul>/<ol> lists; Quill 2.0.x also turns spaces into &nbsp;, so undo that.
  function editorHtml() { return fromEditorSrc(quill.getSemanticHTML().replace(/&nbsp;/g, ' ')); }

  // Never let a pasted <script> or inline handler reach the public site.
  function cleanHtml(html) {
    html = String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '')
      .trim()
      .replace(/(<p>(<br>)?<\/p>)+$/, '');
    return /^(<p>(<br>)?<\/p>)?$/.test(html) ? '' : html;
  }

  function contentHtml() {
    var src = $('#html-source');
    return cleanHtml(src.hidden ? editorHtml() : fromEditorSrc(src.value));
  }

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
    $('#serp-url').textContent = S.siteUrl.replace(/^https?:\/\//, '') + base + (slug || '…') + '/';
    $('#serp-title').textContent = metaTitle.length > 62 ? metaTitle.slice(0, 60) + '…' : metaTitle;
    $('#serp-desc').textContent = desc.length > 160 ? desc.slice(0, 158) + '…' : desc;
    var cover = field('cover_image').value.trim();
    $('#cover-preview').innerHTML = cover ? '<img src="' + esc(previewSrc(cover)) + '" alt="" />' : '';
  }
  form.addEventListener('input', function () { dirty = true; updateMeta(); });

  $('#cover-file').addEventListener('change', function () {
    var file = this.files[0];
    this.value = '';
    if (!file) return;
    upload(file).then(function (sitePath) {
      field('cover_image').value = sitePath;
      if (!field('cover_alt').value) field('cover_alt').value = field('title').value;
      dirty = true;
      updateMeta();
    }).catch(function (err) { toast(err.message, true); });
  });

  $('#editor-back').addEventListener('click', function () { location.hash = listType; });

  var saving = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (saving) return;
    var targetStatus = (e.submitter && e.submitter.getAttribute('data-status')) || 'draft';
    var title = field('title').value.trim();
    if (!title) { toast('Title is required', true); field('title').focus(); return; }
    var slug = slugify(field('slug').value.trim() || title);
    if (!slug) { toast('Please add a URL slug', true); return; }
    var html = contentHtml();
    if (targetStatus === 'published' && !html) { toast('Add some content before publishing', true); return; }

    var old = editing ? editing.post : null;
    var taken = (postsCache[listType] || []).some(function (x) { return x.post.slug === slug && (!editing || x !== editing); });
    if (taken) { toast('The URL slug “' + slug + '” is already used – change it.', true); return; }

    var publishedInput = field('published_at').value;
    var publishedAt = publishedInput ? new Date(publishedInput).toISOString().replace(/\.\d{3}Z$/, 'Z')
      : old && old.published_at ? old.published_at
      : targetStatus === 'published' ? nowIso() : null;

    var post = {
      title: title,
      slug: slug,
      status: targetStatus,
      published_at: publishedAt,
      updated_at: nowIso(),
      created_at: old && old.created_at ? old.created_at : nowIso(),
      content_html: html,
      faqs: $$('.faq-row', $('#faq-list')).map(function (row) {
        return { q: $('.faq-q', row).value.trim(), a: $('.faq-a', row).value.trim() };
      }).filter(function (f) { return f.q && f.a; }),
    };
    TEXT_FIELDS.forEach(function (k) { if (k !== 'title' && k !== 'slug') post[k] = field(k).value.trim(); });
    if (!post.author) post.author = 'Airlines Group Travel';
    if (listType === 'blog') { delete post.airline; delete post.origin; delete post.destination; delete post.price_from; }

    var path = DIRS[listType] + '/' + slug + '.json';
    var renamed = editing && editing.path !== path;
    var verb = targetStatus === 'published' ? 'Publish' : 'Save draft';
    var json = JSON.stringify(post, null, 2) + '\n';

    saving = true;
    $('#editor-msg').textContent = 'Saving to GitHub…';
    putFile(path, b64encode(json), verb + ' ' + listType + ': ' + title, renamed ? undefined : editing && editing.sha)
      .then(function (res) {
        // Slug changed: remove the old file so the old URL disappears.
        if (renamed) return deleteFile(editing.path, editing.sha, 'Rename ' + listType + ': ' + old.slug + ' → ' + slug).then(function () { return res; });
        return res;
      })
      .then(function (res) {
        var item = { post: post, sha: res.content.sha, path: path };
        var list = (postsCache[listType] || []).filter(function (x) { return x !== editing; });
        list.unshift(item);
        postsCache[listType] = list;
        editing = item;
        dirty = false;
        var msg = (targetStatus === 'published' ? 'Published' : 'Draft saved') + ' – the site is rebuilding and will be live in about a minute.';
        toast(msg);
        $('#editor-msg').textContent = msg + ' (' + new Date().toLocaleTimeString() + ')';
        history.replaceState(null, '', '#' + listType + '/' + encodeURIComponent(slug));
        field('slug').value = slug;
        field('published_at').value = toLocalInput(post.published_at);
        $('#status-label').textContent = post.status;
        $('#editor-title').textContent = 'Edit ' + (listType === 'blog' ? 'blog post' : 'flight page');
        setViewLink(post);
        updateMeta();
        setTimeout(refreshDeploys, 4000);
      })
      .catch(function (err) {
        var msg = err.status === 409 || err.status === 422
          ? 'This post was changed somewhere else. Copy your text, reload the page and try again.'
          : err.message;
        toast(msg, true);
        $('#editor-msg').textContent = msg;
      })
      .finally(function () { saving = false; });
  });

  // ---- boot --------------------------------------------------------------------------

  auth = loadAuth();
  if (auth && auth.token) {
    gh('GET', '/repos/' + S.repo).then(start).catch(function (err) { showLogin(err.message); });
  } else {
    showLogin();
  }
})();
