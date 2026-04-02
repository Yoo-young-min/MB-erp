// ===============================
// 공통 하단 네비게이션 (버튼2)
// ===============================

(function () {

  const navHTML = `
  <div class="bottom-nav">
    <div class="nav-container">
      <button onclick="goPage('제품리스트')">제품리스트</button>
      <button onclick="goPage('특수품목리스트')">특수품목리스트</button>
      <button onclick="goPage('3PL리스트')">3PL리스트</button>
      <button onclick="goPage('중상리스트')">중상리스트</button>
    </div>
  </div>
  `;

  const style = `
  <style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 8px 0;
    background: #f4f4f4;
    display: flex;
    justify-content: center;
    z-index: 9999;
  }

  .nav-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-width: 800px;
    justify-content: center;
  }

  .bottom-nav button {
    background-color: #d6ebf5;
    color: black;
    border: none;
    font-size: 14px;
    font-weight: 350;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
  }

  .bottom-nav button:hover {
    opacity: 0.85;
  }

  @media print {
    .bottom-nav {
      display: none !important;
    }
  }

  </style>
  `;

  document.body.insertAdjacentHTML("beforeend", style + navHTML);

})();


// ===============================
// 페이지 이동 설정
// ===============================

function goPage(page) {

  const pageMap = {
    "제품리스트": "제품리스트.html",
    "특수품목리스트": "특수품목리스트.html",
    "3PL리스트": "3PL리스트.html",
    "중상리스트": "중상리스트.html"
  };

  location.href = pageMap[page];
}


const GridManager = (() => {

  const _instances = new WeakMap();

  const DEFAULT_OPTIONS = {
    editOnFocus   : false,
    tabWrap       : true,
    deleteKey     : true,
    copyKey       : true,
    dragSelect    : true,
    undoKey       : true,
    undoLimit     : 100,
    highlightClass: 'gm-selected',
    editableTag   : 'tbody td',
  };

  function init(table, userOptions = {}) {
    if (!(table instanceof HTMLTableElement)) {
      console.warn('[GridManager] HTMLTableElement 이 아닙니다:', table);
      return;
    }
    if (_instances.has(table)) destroy(table);
    const opts  = { ...DEFAULT_OPTIONS, ...userOptions };
    const state = _createState(table, opts);
    _injectStyles(opts.highlightClass);
    _attachEvents(table, state, opts);
    _instances.set(table, { state, opts });
    table.setAttribute('data-gm', 'active');
  }

  function destroy(table) {
    if (!_instances.has(table)) return;
    const { state } = _instances.get(table);
    state.listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
    state.listeners = [];
    _clearSelection(state);
    _instances.delete(table);
    table.removeAttribute('data-gm');
  }

  function undo(table) {
    if (_instances.has(table)) _undo(_instances.get(table).state);
  }

  function redo(table) {
    if (_instances.has(table)) _redo(_instances.get(table).state);
  }

  function _createState(table, opts) {
    return {
      table, opts,
      listeners : [],
      selected  : new Set(),
      anchor    : null,
      dragging  : false,
      undoStack : [],
      redoStack : [],
    };
  }

  function _attachEvents(table, state, opts) {
    const on = (el, type, fn) => {
      el.addEventListener(type, fn);
      state.listeners.push({ el, type, fn });
    };

    on(table, 'keydown', (e) => _handleKeydown(e, state, opts));

    on(table, 'click', (e) => {
      const cell = _closestCell(e.target, opts);
      if (!cell) return;
      _clearSelection(state);
      _selectCell(cell, state);
      _focusCell(cell, opts);
    });

    // 더블클릭 → 커서 위치로 편집 모드 진입
    on(table, 'dblclick', (e) => {
      const cell = _closestCell(e.target, opts);
      if (!cell || cell.contentEditable !== 'true') return;
      e.preventDefault();
      // user-select 일시 해제 후 커서 위치 잡기
      cell.style.userSelect = 'text';
      cell.focus();
      const range = document.caretRangeFromPoint
        ? document.caretRangeFromPoint(e.clientX, e.clientY)
        : null;
      if (range) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    if (opts.dragSelect) {
      on(table, 'mousedown', (e) => {
        const cell = _closestCell(e.target, opts);
        if (!cell) return;
        state.dragging = true;
        state.anchor   = cell;
        _clearSelection(state);
        _selectCell(cell, state);
      });

      on(table, 'mouseover', (e) => {
        if (!state.dragging) return;
        const cell = _closestCell(e.target, opts);
        if (!cell) return;
        _clearSelection(state);
        _selectRange(state.anchor, cell, state);
      });

      const mouseupFn = () => { state.dragging = false; };
      document.addEventListener('mouseup', mouseupFn);
      state.listeners.push({ el: document, type: 'mouseup', fn: mouseupFn });
    }
  }

  function _handleKeydown(e, state, opts) {
    const active = document.activeElement;
    const cell   = _closestCell(active, opts) || _closestCell(e.target, opts);

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && opts.undoKey) {
      e.preventDefault(); _undo(state); return;
    }
    if ((e.ctrlKey || e.metaKey) && opts.undoKey &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault(); _redo(state); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && opts.copyKey) {
      if (state.selected.size > 0) { e.preventDefault(); _copySelection(state); return; }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && opts.deleteKey) {
      if (['INPUT', 'TEXTAREA'].includes(active?.tagName)) return;
      // 단일 셀 선택 시 Delete/Backspace는 기본 동작 허용
      if (state.selected.size <= 1) return;
      e.preventDefault(); _deleteSelection(state); return;
    }

    if (!cell) return;

    const arrows = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
    if (arrows[e.key]) {
      if (['INPUT','TEXTAREA'].includes(active?.tagName) &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      // 더블클릭 편집 모드 중이면 화살표 기본 동작 허용
      if (cell && cell.style.userSelect === 'text') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          // 상하는 편집 종료 후 셀 이동
          cell.style.userSelect = '';
        }
      }
      e.preventDefault();
      _moveCell(cell, ...arrows[e.key], state, opts);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      _moveCell(cell, ...(e.shiftKey ? [0,-1] : [0,1]), state, opts, opts.tabWrap);
      return;
    }
    if (e.key === 'Enter') {
      if (['INPUT','TEXTAREA'].includes(active?.tagName)) {
        e.preventDefault(); _commitEdit(cell);
      }
      _moveCell(cell, 1, 0, state, opts);
      return;
    }
    if (e.key === 'Escape') { _cancelEdit(cell); return; }

    if (opts.editOnFocus && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      if (!cell.querySelector('input')) {
        _enterEdit(cell, e.key); e.preventDefault();
      }
    }
  }

  function _moveCell(fromCell, dr, dc, state, opts, wrap = false) {
    // 편집 모드 종료
    if (fromCell) fromCell.style.userSelect = '';
    const cells  = _getAllCells(state.table, opts);
    const idx    = cells.indexOf(fromCell);
    if (idx < 0) return;
    const cols   = _getColCount(state.table);
    let   target = idx + dr * cols + dc;
    if (wrap) target = (target + cells.length) % cells.length;
    else if (target < 0 || target >= cells.length) return;
    const nextCell = cells[target];
    if (!nextCell) return;
    _clearSelection(state);
    _selectCell(nextCell, state);
    _focusCell(nextCell, opts);
  }

  function _focusCell(cell, opts) {
    if (!opts.editOnFocus) {
      cell.setAttribute('tabindex', '0');
      cell.focus();
      if (cell.contentEditable === 'true') {
        setTimeout(() => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }, 0);
      }
      return;
    }
    const existing = cell.querySelector('input');
    if (existing) { existing.focus(); return; }
    _enterEdit(cell, null);
  }

  function _enterEdit(cell, initChar) {
    const prev = cell.textContent.trim();
    cell.setAttribute('data-gm-prev', prev);
    cell.textContent = '';
    const input = document.createElement('input');
    input.value = initChar !== null ? initChar : prev;
    input.style.cssText = 'width:100%;border:none;outline:none;background:transparent;font:inherit;padding:0;margin:0;box-sizing:border-box;';
    input.addEventListener('blur', () => _commitEdit(cell));
    cell.appendChild(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function _commitEdit(cell) {
    const input = cell.querySelector('input');
    if (!input) return;
    const before = cell.getAttribute('data-gm-prev') ?? '';
    const after  = input.value;
    cell.textContent = after;
    cell.removeAttribute('data-gm-prev');
    cell.setAttribute('tabindex', '0');
    cell.focus();
    if (before !== after) {
      const inst = _getInstanceByCell(cell);
      if (inst) _pushUndo(inst.state, [{ cell, before, after }]);
    }
  }

  function _cancelEdit(cell) {
    const input = cell.querySelector('input');
    if (!input) return;
    cell.textContent = cell.getAttribute('data-gm-prev') ?? '';
    cell.removeAttribute('data-gm-prev');
    cell.setAttribute('tabindex', '0');
    cell.focus();
  }

  function _selectCell(cell, state) {
    state.selected.add(cell);
    cell.classList.add(state.opts.highlightClass);
  }

  function _clearSelection(state) {
    state.selected.forEach(c => c.classList.remove(state.opts.highlightClass));
    state.selected.clear();
  }

  function _selectRange(anchor, end, state) {
    const cells = _getAllCells(state.table, state.opts);
    const cols  = _getColCount(state.table);
    const ai = cells.indexOf(anchor), ei = cells.indexOf(end);
    if (ai < 0 || ei < 0) return;
    const r1 = Math.min(Math.floor(ai/cols), Math.floor(ei/cols));
    const r2 = Math.max(Math.floor(ai/cols), Math.floor(ei/cols));
    const c1 = Math.min(ai%cols, ei%cols), c2 = Math.max(ai%cols, ei%cols);
    cells.forEach((cell, i) => {
      const r = Math.floor(i/cols), c = i%cols;
      if (r >= r1 && r <= r2 && c >= c1 && c <= c2) _selectCell(cell, state);
    });
  }

  function _copySelection(state) {
    const cells = _getAllCells(state.table, state.opts);
    const cols  = _getColCount(state.table);
    const rows  = {};
    state.selected.forEach(cell => {
      const idx = cells.indexOf(cell);
      if (idx < 0) return;
      const r = Math.floor(idx/cols), c = idx%cols;
      if (!rows[r]) rows[r] = {};
      rows[r][c] = cell.textContent.trim();
    });
    const sorted  = Object.keys(rows).sort((a,b) => a-b);
    const allCols = [...new Set(sorted.flatMap(r => Object.keys(rows[r])))].sort((a,b)=>a-b);
    const tsv = sorted.map(r => allCols.map(c => rows[r][c] ?? '').join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => _flashSelection(state, '#b3e5fc')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = tsv; ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
  }

  function _deleteSelection(state) {
    const snapshots = [];
    state.selected.forEach(cell => {
      const before = cell.textContent.trim();
      const input  = cell.querySelector('input');
      if (input) input.value = ''; else cell.textContent = '';
      if (before !== '') snapshots.push({ cell, before, after: '' });
    });
    if (snapshots.length > 0) _pushUndo(state, snapshots);
  }

  function _flashSelection(state, color) {
    state.selected.forEach(cell => {
      const prev = cell.style.backgroundColor;
      cell.style.transition = 'background-color 0.15s';
      cell.style.backgroundColor = color;
      setTimeout(() => {
        cell.style.backgroundColor = prev;
        setTimeout(() => { cell.style.transition = ''; }, 200);
      }, 300);
    });
  }

  function _pushUndo(state, snapshots) {
    state.undoStack.push(snapshots);
    if (state.undoStack.length > state.opts.undoLimit) state.undoStack.shift();
    state.redoStack = [];
  }

  function _undo(state) {
    if (!state.undoStack.length) return;
    const s = state.undoStack.pop();
    s.forEach(({ cell, before }) => _applyValue(cell, before));
    state.redoStack.push(s);
    _focusSnapshots(state, s);
  }

  function _redo(state) {
    if (!state.redoStack.length) return;
    const s = state.redoStack.pop();
    s.forEach(({ cell, after }) => _applyValue(cell, after));
    state.undoStack.push(s);
    _focusSnapshots(state, s);
  }

  function _focusSnapshots(state, snapshots) {
    if (!snapshots.length) return;
    _clearSelection(state);
    snapshots.forEach(({ cell }) => _selectCell(cell, state));
    snapshots[0].cell.setAttribute('tabindex', '0');
    snapshots[0].cell.focus();
  }

  function _applyValue(cell, value) {
    cell.textContent = value;
    cell.setAttribute('tabindex', '0');
  }

  function _getInstanceByCell(cell) {
    const table = cell.closest('table');
    return (table && _instances.has(table)) ? _instances.get(table) : null;
  }

  function _getAllCells(table, opts) {
    return [...table.querySelectorAll(opts.editableTag)];
  }

  function _getColCount(table) {
    const firstRow = table.querySelector('tr');
    return firstRow ? firstRow.querySelectorAll('td, th').length : 1;
  }

  function _closestCell(el, opts) {
    return el?.closest?.(opts.editableTag) ?? null;
  }

  let _stylesInjected = false;
  function _injectStyles(cls) {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.id = 'grid-manager-styles';
    style.textContent = `
      [data-gm] tbody td { cursor:cell; user-select:none; outline:none; }
      [data-gm] tbody td:focus-within {
        outline: 2px solid #4dabf7; outline-offset: -2px;
      }
      .${cls} { background-color: #cfe8ff !important; }
      @media (prefers-color-scheme: dark) {
        .${cls} { background-color: #1c3f6e !important; }
      }
    `;
    document.head.appendChild(style);
  }

  return { init, destroy, undo, redo };

})();


document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('table[data-gm-table]').forEach(table => {
    GridManager.init(table, { editOnFocus: false });
  });
});


function resetGrid(tableId) {
  const t = document.getElementById(tableId);
  if (!t) return;
  GridManager.destroy(t);
  GridManager.init(t);
}

function detachGrid(tableId) {
  const t = document.getElementById(tableId);
  if (t) GridManager.destroy(t);
}

function undoGrid(tableId) {
  const t = document.getElementById(tableId);
  if (t) GridManager.undo(t);
}

function redoGrid(tableId) {
  const t = document.getElementById(tableId);
  if (t) GridManager.redo(t);
}

function readTableData(tableId) {
  const t = document.getElementById(tableId);
  if (!t) return [];
  return [...t.querySelectorAll('tr')].map(row =>
    [...row.querySelectorAll('td, th')].map(cell => cell.textContent.trim())
  );
}