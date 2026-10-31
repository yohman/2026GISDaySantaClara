(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeckReview = factory();
})(typeof window === 'object' ? window : this, function() {
  'use strict';
  function cleanTitles(titles, ids) {
    const result = {};
    if (!titles || typeof titles !== 'object' || Array.isArray(titles)) return result;
    Object.entries(titles).slice(0, 1000).forEach(([id, s]) => {
      if ((!ids.includes(id) && !/^title-[a-z0-9-]+$/i.test(id)) || !s || typeof s.text !== 'string' || !s.text.trim()) return;
      const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback;
      result[id] = { id, text: s.text.slice(0, 2000), emphasis: typeof s.emphasis === 'string' ? s.emphasis.slice(0, 500) : '',
        fontSize: Math.max(32, Math.min(200, Number(s.fontSize) || 102)),
        textColor: color(s.textColor, '#777777'), emphasisColor: color(s.emphasisColor, '#ffffff'),
        section: typeof s.section === 'string' ? s.section.slice(0, 60) : 'Titles',
        note: typeof s.note === 'string' ? s.note.slice(0, 5000) : '' };
    });
    return result;
  }
  function reconcile(ids, saved) {
    const titles = cleanTitles(saved?.titles, ids);
    const known = new Set([...ids, ...Object.keys(titles)]);
    const seen = new Set();
    const order = (Array.isArray(saved?.order) ? saved.order : []).filter(id => {
      if (!known.has(id) || seen.has(id)) return false;
      seen.add(id); return true;
    });
    // A source update adds new material without resurrecting removed slides.
    ids.forEach((id, i) => {
      if (seen.has(id)) return;
      let previous = i - 1;
      while (previous >= 0 && !seen.has(ids[previous])) previous--;
      order.splice(previous < 0 ? 0 : order.indexOf(ids[previous]) + 1, 0, id);
      seen.add(id);
    });
    Object.keys(titles).forEach(id => { if (!seen.has(id)) order.push(id); });
    return { order, deleted: [...new Set(Array.isArray(saved?.deleted) ? saved.deleted : [])].filter(id => known.has(id)), titles };
  }
  function active(state) {
    const removed = new Set(state.deleted);
    return state.order.filter(id => !removed.has(id));
  }
  function remove(state, ids) {
    return { ...state, order: [...state.order], deleted: [...new Set([...state.deleted, ...ids.filter(id => state.order.includes(id))])] };
  }
  function restore(state, ids) {
    const restored = new Set(ids);
    return { ...state, order: [...state.order], deleted: state.deleted.filter(id => !restored.has(id)) };
  }
  // Position is the desired zero-based position in the final visible sequence.
  function move(state, ids, position) {
    const selected = new Set(ids);
    const moving = active(state).filter(id => selected.has(id));
    if (!moving.length) return state;
    const rest = state.order.filter(id => !selected.has(id));
    const removed = new Set(state.deleted);
    const visible = rest.filter(id => !removed.has(id));
    const target = visible[Math.max(0, Math.min(visible.length, position))];
    const at = target === undefined ? rest.length : rest.indexOf(target);
    rest.splice(at, 0, ...moving);
    return { ...state, order: rest, deleted: [...state.deleted] };
  }
  function title(state, slide, position) {
    const normalized = cleanTitles({ [slide.id]: slide }, state.order)[slide.id];
    if (!normalized) throw new Error('Enter title text.');
    const next = { ...state, titles: { ...state.titles, [slide.id]: normalized }, order: [...state.order] };
    if (!next.order.includes(slide.id)) {
      const target = active(next)[Math.max(0, position)];
      next.order.splice(target ? next.order.indexOf(target) : next.order.length, 0, slide.id);
    }
    return next;
  }
  function range(order, anchor, target) {
    const a = order.indexOf(anchor), b = order.indexOf(target);
    return a < 0 || b < 0 ? [] : order.slice(Math.min(a, b), Math.max(a, b) + 1);
  }
  function importState(data, ids) {
    if (data?.format !== 'gisday-santaclara-review' || data.version !== 1 ||
        !Array.isArray(data.order) || !Array.isArray(data.deleted) ||
        !data.order.every(id => typeof id === 'string') ||
        !data.deleted.every(id => typeof id === 'string') ||
        !data.order.some(id => ids.includes(id) || cleanTitles(data.titles, ids)[id])) {
      throw new Error('Choose an edits file exported from this presentation.');
    }
    return reconcile(ids, data);
  }
  return { reconcile, active, remove, restore, move, importState, title, range };
});
