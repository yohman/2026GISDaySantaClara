(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeckReview = factory();
})(typeof window === 'object' ? window : this, function() {
  'use strict';
  function reconcile(ids, saved) {
    const known = new Set(ids);
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
    return { order, deleted: [...new Set(Array.isArray(saved?.deleted) ? saved.deleted : [])].filter(id => known.has(id)) };
  }
  function active(state) {
    const removed = new Set(state.deleted);
    return state.order.filter(id => !removed.has(id));
  }
  function remove(state, ids) {
    return { order: [...state.order], deleted: [...new Set([...state.deleted, ...ids.filter(id => state.order.includes(id))])] };
  }
  function restore(state, ids) {
    const restored = new Set(ids);
    return { order: [...state.order], deleted: state.deleted.filter(id => !restored.has(id)) };
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
    return { order: rest, deleted: [...state.deleted] };
  }
  function importState(data, ids) {
    if (data?.format !== 'gisday-santaclara-review' || data.version !== 1 ||
        !Array.isArray(data.order) || !Array.isArray(data.deleted) ||
        !data.order.every(id => typeof id === 'string') ||
        !data.deleted.every(id => typeof id === 'string') ||
        !data.order.some(id => ids.includes(id))) {
      throw new Error('Choose an edits file exported from this presentation.');
    }
    return reconcile(ids, data);
  }
  return { reconcile, active, remove, restore, move, importState };
});
