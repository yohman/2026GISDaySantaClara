(() => {
  'use strict';
  const catalog = JSON.parse(document.getElementById('deck-data').textContent);
  const byId = new Map(catalog.map(s => [s.id, s]));
  const ids = catalog.map(s => s.id);
  const model = DeckReview;
  const key = 'gisday-santaclara-review-v1' + (document.documentElement.dataset.exported ? '-snapshot' : '');
  const requestedSlide = parseInt(location.hash.slice(1));
  const $ = id => document.getElementById(id);
  let saved, storageError = false;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageError = true; }
  let state = model.reconcile(ids, saved);
  const slide = id => state.titles[id] || byId.get(id);
  let past = [], future = [], selected = new Set(), view = 'active', dragIds = [], suppressCardClickUntil = 0;
  let current = 0, visible = [], timer, toastTimer, lastSelected;
  let restoredCursor = saved?.currentId;
  const stage = $('stage'), review = $('review'), grid = $('review-grid');
  const sizeKey = 'gisday-santaclara-thumbnail-size';
  function setSlideSize(value, persist = false) {
    const size = Math.max(120, Math.min(480, Number(value) || 235));
    grid.style.setProperty('--slide-width', size + 'px');
    $('slide-size').value = size;
    $('slide-size').setAttribute('aria-valuetext', `${Math.round(size / 235 * 100)} percent`);
    $('slide-size-value').textContent = `${Math.round(size / 235 * 100)}%`;
    if (persist) { try { localStorage.setItem(sizeKey, String(size)); } catch {} }
  }
  let savedSize;
  try { savedSize = localStorage.getItem(sizeKey); } catch {}
  setSlideSize(savedSize || (innerWidth <= 650 ? 150 : 235));
  $('slide-size').oninput = e => setSlideSize(e.target.value, true);
  const label = s => s.text || s.alt || 'Photograph';
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify({ ...state, currentId: visible[current], version: 1 }));
      storageError = false;
    } catch { storageError = true; }
    $('save-status').textContent = storageError ? 'Unable to save here — export your edits' : 'Saved in this browser';
  }
  function toast(message, undoable = false) {
    $('toast-text').textContent = message;
    $('toast-undo').hidden = !undoable;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function phrase(s) {
    const h = document.createElement('h1');
    if (s.fontSize) h.style.fontSize = `${s.fontSize / 12.8}cqw`;
    if (s.textColor) h.style.color = s.textColor;
    if (s.emphasis && s.text.includes(s.emphasis)) {
      const at = s.text.indexOf(s.emphasis);
      const before = document.createElement('span'); before.className = 'dim';
      before.textContent = s.text.slice(0, at);
      h.append(before);
      if (s.breakBefore) { before.textContent = before.textContent.trimEnd(); h.append(document.createElement('br')); }
      const em = document.createElement('em'); em.textContent = s.emphasis; h.append(em);
      const after = document.createElement('span'); after.className = 'dim';
      after.textContent = s.text.slice(at + s.emphasis.length); h.append(after);
    } else h.textContent = s.text;
    if (s.textColor) h.querySelectorAll('.dim').forEach(el => el.style.color = s.textColor);
    if (s.emphasisColor) h.querySelectorAll('em').forEach(el => el.style.color = s.emphasisColor);
    return h;
  }
  function picture(src, alt, classes, lazy) {
    const im = new Image(); im.alt = alt || ''; im.className = classes || ''; im.draggable = false;
    im.decoding = 'async';
    if (lazy === 'stage') im.dataset.src = src;
    else { im.loading = 'lazy'; im.src = src; }
    return im;
  }
  function visual(s, lazy) {
    if (s.images) {
      const pair = document.createElement('div'); pair.className = 'image-pair';
      s.images.forEach(p => {
        const im = picture(p.src, p.alt, p.portrait ? 'pair-portrait' : 'pair-wide', lazy);
        im.style.objectPosition = p.position || 'center center';
        if (p.ratio) im.style.setProperty('--ratio', p.ratio);
        pair.append(im);
      }); return pair;
    }
    if (s.image) {
      const im = picture(s.image, s.alt, [s.color ? 'color' : '', s.fit ? 'fit' : ''].join(' '), lazy);
      if (s.position) im.style.objectPosition = s.position;
      return im;
    }
    return phrase(s);
  }
  function loadNearby() {
    for (let i = Math.max(0, current - 1); i <= Math.min(visible.length - 1, current + 2); i++) {
      stage.children[i]?.querySelectorAll('img[data-src]').forEach(im => { im.src = im.dataset.src; delete im.dataset.src; });
    }
  }
  let fadeToken = 0, pendingIndex = null, fadeAnimation;
  function cancelFade() {
    fadeToken++; pendingIndex = null; fadeAnimation?.cancel(); fadeAnimation = null; stage.style.opacity = '1';
  }
  async function go(index, remember = true, animate = true) {
    const target = Math.max(0, Math.min(visible.length - 1, index));
    if (!animate || !remember || review.open || target === current && pendingIndex === null || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancelFade(); show(target, remember); return;
    }
    const opacity = getComputedStyle(stage).opacity;
    const token = ++fadeToken; pendingIndex = target;
    fadeAnimation?.cancel();
    try {
      fadeAnimation = stage.animate([{opacity}, {opacity:0}], {duration:250, easing:'ease-in', fill:'forwards'});
      await fadeAnimation.finished;
      if (token !== fadeToken) return;
      stage.style.opacity = '0'; fadeAnimation.cancel(); show(target, remember);
      fadeAnimation = stage.animate([{opacity:0}, {opacity:1}], {duration:250, easing:'ease-out', fill:'forwards'});
      await fadeAnimation.finished;
      if (token !== fadeToken) return;
      stage.style.opacity = '1'; fadeAnimation.cancel(); fadeAnimation = null; pendingIndex = null;
    } catch { /* A newer navigation or edit superseded this fade. */ }
  }
  function advance(delta) { go((pendingIndex ?? current) + delta); }
  function show(index, remember = true) {
    current = Math.max(0, Math.min(visible.length - 1, index));
    [...stage.children].forEach((el, n) => {
      el.classList.toggle('active', n === current); el.setAttribute('aria-hidden', String(n !== current));
    });
    $('count').textContent = visible.length ? `${current + 1} / ${visible.length}` : '0 slides';
    $('prev').disabled = current <= 0; $('next').disabled = current >= visible.length - 1;
    $('remove-current').disabled = !visible.length;
    $('note').textContent = slide(visible[current])?.note || '';
    $('announce').textContent = visible.length ? `Slide ${current + 1}` : 'All slides removed. Open Edit slides to restore them.';
    if (visible.length) {
      const url = new URL(location.href); url.hash = String(current + 1);
      try { history.replaceState(null, '', url.href); } catch { /* A local HTML snapshot can still present. */ }
    }
    loadNearby();
    if (remember) save();
  }
  function renderStage(keepId) {
    cancelFade();
    visible = model.active(state);
    const frag = document.createDocumentFragment();
    visible.forEach(id => {
      const s = slide(id), el = document.createElement('section');
      el.className = 'slide'; el.dataset.slideId = id;
      el.setAttribute('aria-label', label(s)); el.setAttribute('aria-hidden', 'true');
      el.append(visual(s, 'stage')); frag.append(el);
    });
    stage.replaceChildren(frag);
    const at = visible.indexOf(keepId);
    go(at >= 0 ? at : current, false);
  }
  function commit(next, message) {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    const keep = visible[current];
    past.push(copy(state)); if (past.length > 60) past.shift();
    future = []; state = next;
    selected = new Set([...selected].filter(id => !state.deleted.includes(id)));
    renderStage(keep); save(); renderReview();
    if (message) toast(message, true);
  }
  function undo() {
    if (!past.length) return;
    future.push(copy(state)); state = past.pop(); selected.clear();
    renderStage(visible[current]); save(); renderReview(); toast('Undone');
  }
  function redo() {
    if (!future.length) return;
    past.push(copy(state)); state = future.pop(); selected.clear();
    renderStage(visible[current]); save(); renderReview(); toast('Redone');
  }
  function remove(idsToRemove) {
    if (!idsToRemove.length) return;
    commit(model.remove(state, idsToRemove), `${idsToRemove.length === 1 ? 'Slide' : idsToRemove.length + ' slides'} removed`);
  }
  function move(idsToMove, position) {
    commit(model.move(state, idsToMove, position), 'Slide order saved');
  }
  function matching() {
    const source = view === 'active' ? model.active(state) : state.order.filter(id => state.deleted.includes(id));
    const term = $('search').value.toLowerCase().trim(), section = $('section').value;
    return source.filter(id => {
      const s = slide(id);
      return (!section || s.section === section) && (!term || `${label(s)} ${s.note || ''} ${s.section || ''}`.toLowerCase().includes(term));
    });
  }
  function updateSelection() {
    document.body.classList.toggle('selection-active', selected.size > 0);
    grid.querySelectorAll('.card').forEach(card => {
      const checked = selected.has(card.dataset.id);
      card.classList.toggle('selected', checked);
      card.querySelector('input[type=checkbox]').checked = checked;
    });
    $('selection-count').textContent = selected.size ? `${selected.size} selected · Click slides to add or remove` : 'Click a thumbnail to preview, or select a slide to begin';
    const shown = matching();
    $('select-all').disabled = !shown.length || shown.every(id => selected.has(id));
    $('deselect-all').disabled = !selected.size;
    $('delete-selected').disabled = !selected.size || view !== 'active';
    $('restore-selected').disabled = !selected.size || view !== 'removed';
    $('move-selected').disabled = !selected.size || view !== 'active';
  }
  function select(id, shift, checked) {
    if (shift && lastSelected) {
      const shown = matching(), a = shown.indexOf(lastSelected), b = shown.indexOf(id);
      if (a >= 0 && b >= 0) shown.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => selected.add(x));
    } else if (checked) selected.add(id); else selected.delete(id);
    lastSelected = id; updateSelection();
  }
  function cardButton(text, name, action) {
    const b = document.createElement('button'); b.textContent = text;
    b.setAttribute('aria-label', name); b.title = name; b.onclick = action; return b;
  }
  function glyphButton(kind, name, action) {
    const b = cardButton('', name, action);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('glyph');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', kind === 'trash' ? 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7' : 'M14 5l5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z');
    svg.append(p); b.append(svg); return b;
  }
  function pointerGrip(handle, id) {
    handle.addEventListener('pointerdown', start => {
      if (start.button !== 0) return;
      start.preventDefault(); handle.setPointerCapture(start.pointerId);
      const moving = selected.has(id) ? model.active(state).filter(x => selected.has(x)) : [id];
      let target, after = false, moved = false;
      const clear = () => grid.querySelectorAll('.card').forEach(c => c.classList.remove('dragging','drop-before','drop-after'));
      const track = e => {
        if (Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < 5 && !moved) return;
        moved = true; clear();
        grid.querySelectorAll('.card').forEach(c => c.classList.toggle('dragging', moving.includes(c.dataset.id)));
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card');
        target = hit && !moving.includes(hit.dataset.id) ? hit.dataset.id : null;
        if (target) { const r = hit.getBoundingClientRect(); after = e.clientX > r.x + r.width / 2; hit.classList.add(after ? 'drop-after' : 'drop-before'); }
        const r = grid.getBoundingClientRect();
        if (e.clientY < r.top + 60) grid.scrollTop -= 22;
        if (e.clientY > r.bottom - 60) grid.scrollTop += 22;
      };
      const finish = e => {
        handle.removeEventListener('pointermove', track); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel);
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        clear();
        if (moved) suppressCardClickUntil = performance.now() + 350;
        if (moved && target) {
          const remaining = model.active(state).filter(x => !moving.includes(x));
          move(moving, remaining.indexOf(target) + (after ? 1 : 0));
        }
      };
      const cancel = e => { target = null; finish(e); };
      handle.addEventListener('pointermove', track); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', cancel);
    });
  }
  function renderReview() {
    $('undo').disabled = !past.length; $('redo').disabled = !future.length;
    $('active-tab').textContent = `Slides (${model.active(state).length})`;
    $('removed-tab').textContent = `Removed (${state.deleted.length})`;
    $('active-tab').setAttribute('aria-pressed', view === 'active');
    $('removed-tab').setAttribute('aria-pressed', view === 'removed');
    $('restore-selected').hidden = view !== 'removed'; $('delete-selected').hidden = view !== 'active';
    $('move-controls').hidden = view !== 'active';
    if (!review.open) return;
    const scroll = grid.scrollTop, shown = matching(), frag = document.createDocumentFragment();
    const order = model.active(state);
    $('move-position').max = Math.max(1, order.length);
    shown.forEach(id => {
      const s = slide(id), index = order.indexOf(id), card = document.createElement('article');
      card.className = 'card'; card.dataset.id = id; card.draggable = view === 'active';
      card.addEventListener('click', e => {
        if (performance.now() < suppressCardClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
        if (!selected.size) return;
        const anchor = [...selected][0];
        if (selected.has(id)) selected.delete(id);
        else if (selected.size === 1) selected = new Set(model.range(view === 'active' ? model.active(state) : matching(), anchor, id));
        else selected.add(id);
        if (!e.target.matches('input[type=checkbox]')) e.preventDefault();
        e.stopPropagation(); lastSelected = selected.size ? anchor : undefined; updateSelection();
      }, true);
      const title = label(s), number = index >= 0 ? String(index + 1).padStart(2, '0') : '—';
      const thumb = cardButton('', `Preview ${number}: ${title}`, () => {
        if (view === 'removed') return;
        review.close(); go(model.active(state).indexOf(id), true, false); controls();
      });
      thumb.className = 'thumb'; thumb.append(visual(s, 'thumb')); card.append(thumb);
      const info = document.createElement('div'); info.className = 'card-info';
      const check = document.createElement('input'); check.type = 'checkbox';
      check.setAttribute('aria-label', `Select ${number}: ${title}`);
      check.onclick = e => select(id, e.shiftKey, check.checked);
      const num = document.createElement('span'); num.className = 'number'; num.textContent = number;
      const caption = document.createElement('span'); caption.className = 'title'; caption.textContent = title; caption.title = title;
      info.append(check, num, caption); card.append(info);
      const actions = document.createElement('div'); actions.className = 'card-actions';
      if (view === 'active') {
        const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.textContent = '⠿'; handle.title = 'Drag to reorder'; handle.setAttribute('aria-hidden', 'true'); pointerGrip(handle, id); actions.append(handle);
        const before = cardButton('←', `Move slide ${number} earlier`, () => move([id], index - 1)); before.disabled = index === 0;
        const after = cardButton('→', `Move slide ${number} later`, () => move([id], index + 1)); after.disabled = index === order.length - 1;
        const del = glyphButton('trash', `Remove slide ${number}`, () => remove([id])); del.className = 'remove';
        actions.append(before, after);
        if (s.text) actions.append(glyphButton('pencil', `Edit title slide ${number}`, () => openTitle(id)));
        actions.append(del);
      } else actions.append(cardButton('↶', `Restore ${title}`, () => commit(model.restore(state, [id]), 'Slide restored')));
      card.append(actions);
      card.addEventListener('click', e => {
        if (!e.target.closest('button,input,.drag-handle')) select(id, e.shiftKey, !selected.has(id));
      });
      card.addEventListener('dragstart', e => {
        if (view !== 'active' || e.target.closest('button,input')) { e.preventDefault(); return; }
        dragIds = selected.has(id) ? model.active(state).filter(x => selected.has(x)) : [id];
        e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging');
      });
      card.addEventListener('dragover', e => {
        if (!dragIds.length || dragIds.includes(id)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        const rect = card.getBoundingClientRect(), after = e.clientX > rect.x + rect.width / 2;
        card.classList.toggle('drop-before', !after); card.classList.toggle('drop-after', after);
        const bounds = grid.getBoundingClientRect();
        if (e.clientY < bounds.top + 60) grid.scrollTop -= 18;
        if (e.clientY > bounds.bottom - 60) grid.scrollTop += 18;
      });
      card.addEventListener('dragleave', () => card.classList.remove('drop-before', 'drop-after'));
      card.addEventListener('drop', e => {
        e.preventDefault(); if (!dragIds.length || dragIds.includes(id)) return;
        const rect = card.getBoundingClientRect();
        const remaining = model.active(state).filter(x => !dragIds.includes(x));
        const at = remaining.indexOf(id) + (e.clientX > rect.x + rect.width / 2 ? 1 : 0);
        move(dragIds, at); dragIds = [];
      });
      card.addEventListener('dragend', () => { dragIds = []; grid.querySelectorAll('.card').forEach(c => c.classList.remove('dragging', 'drop-before', 'drop-after')); });
      frag.append(card);
    });
    if (!shown.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = view === 'removed' ? 'No removed slides match this view.' : 'No slides match this view.'; frag.append(empty); }
    grid.replaceChildren(frag); grid.scrollTop = scroll; updateSelection();
    $('review-count').textContent = `${shown.length} shown · ${catalog.length} in source collection`;
  }
  function openReview(revealCurrent = false) {
    cancelFade();
    $('speaker').close(); document.body.classList.remove('blank');
    if (revealCurrent) { view = 'active'; $('search').value = ''; $('section').value = ''; }
    if (!review.open) review.showModal(); renderReview();
    if (revealCurrent) requestAnimationFrame(() => [...grid.children].find(el => el.dataset.id === visible[current])?.scrollIntoView({block:'nearest'}));
  }
  function controls() {
    document.body.classList.add('controls'); clearTimeout(timer);
    timer = setTimeout(() => document.body.classList.remove('controls'), 2000);
  }
  let manualFullscreenExit = false, wasFullscreen = Boolean(document.fullscreenElement);
  async function full() {
    try { if (document.fullscreenElement) { manualFullscreenExit = true; await document.exitFullscreen(); } else await document.documentElement.requestFullscreen(); } catch { manualFullscreenExit = false; controls(); }
  }
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    if (wasFullscreen && !isFullscreen && !manualFullscreenExit && !review.open && !$('title-editor').open) openReview(true);
    wasFullscreen = isFullscreen; if (!isFullscreen) manualFullscreenExit = false;
  });
  let editingTitleId = null;
  function titleValues() {
    return { id: editingTitleId || 'title-' + crypto.randomUUID(), text: $('title-text').value.trim(),
      emphasis: $('title-emphasis').value, textColor: $('title-color').value,
      emphasisColor: $('title-emphasis-color').value, fontSize: Number($('title-size').value) || 102,
      section: editingTitleId ? slide(editingTitleId).section : 'Titles',
      note: editingTitleId ? slide(editingTitleId).note || '' : '' };
  }
  function previewTitle() {
    const s = titleValues();
    if (!s.text) s.text = 'Title';
    $('title-preview').replaceChildren(phrase(s));
    $('title-size-slider').value = $('title-size').value;
    $('title-error').textContent = '';
  }
  function openTitle(id = null) {
    editingTitleId = id;
    const s = id ? slide(id) : {};
    let text = s.text || '';
    if (s.breakBefore && s.emphasis) text = text.replace(s.emphasis, '\n' + s.emphasis).replace(/ +\n/g, '\n');
    $('title-text').value = text;
    $('title-emphasis').value = s.emphasis || '';
    $('title-color').value = s.textColor || (!id || s.emphasis ? '#777777' : '#ffffff');
    $('title-emphasis-color').value = s.emphasisColor || '#ffffff';
    $('title-size').value = s.fontSize || 102;
    $('title-position-row').hidden = Boolean(id);
    $('title-position').max = visible.length + 1;
    const anchor = selected.size === 1 ? visible.indexOf([...selected][0]) : current;
    $('title-position').value = Math.min(visible.length + 1, Math.max(1, anchor + 2));
    $('title-heading').textContent = id ? 'Edit title slide' : 'New title slide';
    previewTitle(); $('title-editor').showModal(); $('title-text').focus();
  }
  $('add-title').onclick = () => openTitle();
  $('title-form').onsubmit = e => {
    e.preventDefault(); const s = titleValues(), position = Number($('title-position').value);
    if (!s.text) { $('title-error').textContent = 'Enter a title.'; return; }
    if (!editingTitleId && (!Number.isInteger(position) || position < 1 || position > visible.length + 1)) { $('title-error').textContent = 'Choose a position in the deck.'; return; }
    commit(model.title(state, s, position - 1), editingTitleId ? 'Title updated' : 'Title slide added');
    $('title-editor').close();
    if (!editingTitleId) { view = 'active'; $('section').value = ''; $('search').value = ''; selected = new Set([s.id]); renderReview();
      requestAnimationFrame(() => [...grid.children].find(el => el.dataset.id === s.id)?.scrollIntoView({block:'nearest'})); }
  };
  ['title-text','title-emphasis','title-color','title-emphasis-color','title-size'].forEach(id => $(id).oninput = previewTitle);
  $('title-size-slider').oninput = () => { $('title-size').value = $('title-size-slider').value; previewTitle(); };
  $('title-cancel').onclick = () => $('title-editor').close();
  function download(content, name, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('export').onclick = () => {
    $('file-menu').hidePopover();
    const data = { format: 'gisday-santaclara-review', version: 1, exportedAt: new Date().toISOString(),
      ...state, slides: model.active(state).map(slide) };
    download(JSON.stringify(data, null, 2), 'GIS-Day-Santa-Clara-edits.json', 'application/json');
    toast('Edits exported. Import them on another browser or send them back for PowerPoint.');
  };
  $('download-deck').onclick = () => {
    $('file-menu').hidePopover();
    const doc = document.documentElement.cloneNode(true);
    doc.querySelector('#deck-data').textContent = JSON.stringify(model.active(state).map(slide)).replace(/</g, '\\u003c');
    doc.querySelector('#stage').replaceChildren(); doc.querySelector('#review-grid').replaceChildren();
    doc.querySelectorAll('dialog').forEach(d => d.removeAttribute('open'));
    doc.querySelector('#toast').hidden = true; doc.querySelector('body').className = '';
    const base = document.createElement('base'); base.href = 'https://yohman.github.io/2026GISDaySantaClara/'; doc.querySelector('head').prepend(base);
    doc.querySelector('html')?.removeAttribute('style');
    doc.setAttribute('data-exported', 'true');
    download('<!doctype html>\n' + doc.outerHTML, 'GIS-Day-Santa-Clara-edited.html', 'text/html');
    toast('Edited HTML downloaded. Images and fonts load from the website.');
  };
  $('import-file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try { if (file.size > 5e6) throw new Error('Choose a smaller edits JSON file.');
      const next = model.importState(JSON.parse(await file.text()), ids);
      commit(next, 'Edits imported');
    } catch (err) { toast(err.message || 'Could not read that edits file.'); }
    e.target.value = '';
  };
  $('import-action').onclick = () => { $('import-file').click(); $('file-menu').hidePopover(); };
  $('undo').onclick = undo; $('redo').onclick = redo; $('toast-undo').onclick = undo;
  $('delete-selected').onclick = () => remove([...selected]);
  $('restore-selected').onclick = () => { const toRestore = [...selected]; selected.clear(); commit(model.restore(state, toRestore), 'Slides restored'); };
  $('move-selected').onclick = () => { const n = Number($('move-position').value); if (!Number.isInteger(n) || n < 1 || n > visible.length) { toast(`Enter a slide number from 1 to ${visible.length}.`); return; } move([...selected], n - 1); };
  $('active-tab').onclick = () => { view = 'active'; selected.clear(); renderReview(); };
  $('removed-tab').onclick = () => { view = 'removed'; selected.clear(); renderReview(); };
  $('select-all').onclick = () => { matching().forEach(id => selected.add(id)); updateSelection(); };
  $('deselect-all').onclick = () => { selected.clear(); lastSelected = undefined; updateSelection(); };
  $('search').oninput = () => { selected.clear(); renderReview(); };
  $('section').onchange = () => { selected.clear(); renderReview(); };
  $('prev').onclick = () => advance(-1); $('next').onclick = () => advance(1);
  $('fullscreen').onclick = full; $('edit').onclick = () => openReview();
  $('remove-current').onclick = () => remove(visible[current] ? [visible[current]] : []);
  $('notes').onclick = () => $('speaker').showModal();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { b.closest('dialog').close(); controls(); });
  document.addEventListener('mousemove', controls);
  document.addEventListener('keydown', e => {
    const typing = e.target.closest('input,textarea,select');
    if ($('title-editor').open) return;
    if (review.open) {
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); $(e.shiftKey ? 'deselect-all' : 'select-all').click(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (view === 'active') remove([...selected]); }
      return;
    }
    if (e.key === 'Escape' && !review.open && !document.querySelector('dialog[open]')) {
      e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); openReview(true); return;
    }
    if (typing || document.querySelector('dialog[open]')) return;
    if (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    if (['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)) { e.preventDefault(); advance(1); }
    else if (['ArrowLeft','ArrowUp','PageUp'].includes(e.key)) { e.preventDefault(); advance(-1); }
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(visible.length - 1);
    else if (e.key.toLowerCase() === 'f') full();
    else if (['e','o'].includes(e.key.toLowerCase())) openReview();
    else if (e.key.toLowerCase() === 'n') $('speaker').showModal();
    else if (e.key.toLowerCase() === 'b') document.body.classList.toggle('blank');
  });
  let startX = 0, startY = 0;
  stage.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; startY = e.changedTouches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) advance(dx < 0 ? 1 : -1); else controls();
  }, { passive: true });
  stage.addEventListener('click', e => { if (e.clientX > innerWidth * .65) advance(1); else if (e.clientX < innerWidth * .35) advance(-1); else controls(); });
  const sections = [...new Set([...catalog.map(s => s.section).filter(Boolean), 'Titles'])];
  sections.forEach(section => { const option = document.createElement('option'); option.value = section; option.textContent = section; $('section').append(option); });
  // Downloaded HTML is an explicit edited snapshot, separate from the live browser draft.
  if (document.documentElement.dataset.exported) state = model.reconcile(ids, null);
  renderStage(restoredCursor);
  go(Number.isFinite(requestedSlide) ? requestedSlide - 1 : Math.max(0, visible.indexOf(restoredCursor)), false);
  save(); controls(); renderReview();
  if (new URLSearchParams(location.search).has('edit')) openReview();
})();
