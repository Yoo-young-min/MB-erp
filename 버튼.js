// ===============================
// 공통 하단 네비게이션
// ===============================

(function () {

  const navHTML = `
  <div class="bottom-nav">
    <div class="nav-container">
      <button onclick="goPage('쇼주문')">(쇼)주문</button>
      <button onclick="goPage('이주문')">(이)주문</button>
      <button onclick="goPage('쿠주문')">(쿠)주문</button>
      <button onclick="goPage('스주문')">(스)주문</button>
      <button onclick="goPage('발송선택')">발송선택</button>
      <button onclick="goPage('3PL발송')">3PL발송</button>
      <button onclick="goPage('포장')">포장</button>
      <button onclick="goPage('물건챙기기')">물건챙기기</button>
      <button onclick="goPage('송장파일입력')">송장(파일입력)</button>
      <button onclick="goPage('화물송품장')">화물송품장</button>
      <button onclick="goPage('화물택배송품장')">화물택배송품장</button>
      <button onclick="goPage('쇼핑몰품목만')">쇼핑몰품목만</button>
      <button class="cargo-daily-btn" onclick="goPage('화물송품장당일')">화물송품장(당일)</button>
      <button class="cargo-daily-btn" onclick="goPage('화물택배송품장당일')">화물택배송품장(당일)</button>
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
    max-width: 1400px;
    justify-content: center;
  }
  .bottom-nav button {
    background-color: #d6ebf5;
    color: black;
    border: none;
    font-size: 14px;
    font-weight: 350;
    padding: 6px 6px;
    border-radius: 4px;
    cursor: pointer;
  }
  .bottom-nav button:hover { opacity: 0.85; }
  /* ★ 화물(당일) 버튼 - 옅은 주황 */
  .bottom-nav button.cargo-daily-btn {
    background-color: #ffe0b2;
  }
  @media print { .bottom-nav { display: none !important; } }
  body.right-align .nav-container {
    justify-content: flex-end;
    max-width: 700px;
  }

  /* ★ 인쇄 시 thead 배경색 유지 */
  @media print {
    thead th {
      background-color: #d9d9d9 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
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
    "쇼주문"            : "(쇼)주문.html",
    "이주문"            : "(이)주문.html",
    "쿠주문"            : "(쿠)주문.html",
    "스주문"            : "(스)주문.html",
    "발송선택"          : "발송선택.html",
    "3PL발송"           : "3PL발송.html",
    "포장"              : "포장.html",
    "물건챙기기"        : "물건챙기기.html",
    "송장파일입력"      : "송장(파일입력).html",
    "화물송품장"        : "화물송품장.html",
    "화물송품장당일"    : "화물송품장(당일).html",
    "화물택배송품장"    : "화물택배송품장.html",
    "화물택배송품장당일": "화물택배송품장(당일).html",
    "쇼핑몰품목만"      : "쇼핑몰품목만.html"
  };
  location.href = pageMap[page];
}


/**
 * 버튼.js
 * ── 단축키 ──────────────────────────────────────────
 *   방향키          셀 이동
 *   Tab / Shift+Tab 오른쪽/왼쪽 이동 (끝 → 다음 행)
 *   Enter           아래 이동
 *   Escape          편집 취소 (원래 값으로)
 *   Delete          선택 범위 내용 삭제
 *   Ctrl+C          선택 범위 복사 (TSV, 엑셀 붙여넣기 호환)
 *   Ctrl+Z          실행 취소 (undo)
 *   Ctrl+Y          다시 실행 (redo)
 *   마우스 드래그   범위 선택
 */

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
    state.listeners.forEach(({ el, type, fn, cap }) =>
      el.removeEventListener(type, fn, cap));
    state.listeners = [];
    _clearSelection(state);
    _instances.delete(table);
    table.removeAttribute('data-gm');
  }

  function undo(table) { if (_instances.has(table)) _undo(_instances.get(table).state); }
  function redo(table) { if (_instances.has(table)) _redo(_instances.get(table).state); }

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
    const on = (el, type, fn, cap = false) => {
      el.addEventListener(type, fn, cap);
      state.listeners.push({ el, type, fn, cap });
    };

    on(table, 'keydown', (e) => _handleKeydown(e, state, opts));

    on(document, 'keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'c') return;
      if (state.selected.size > 1) {
        e.preventDefault();
        _copySelection(state);
      }
    });

    on(table, 'click', (e) => {
      const cell = _closestCell(e.target, opts);
      if (!cell) return;
      _clearSelection(state);
      state.anchor = cell;
      _selectCell(cell, state);
      _focusCell(cell, opts);
    });

    on(table, 'focusin', (e) => {
      const cell = _closestCell(e.target, opts);
      if (!cell) return;
      cell.dataset.gmBefore = cell.innerText;
    }, true);

    on(table, 'blur', (e) => {
      const cell = _closestCell(e.target, opts);
      if (!cell) return;
      const before = cell.dataset.gmBefore ?? '';
      const after  = cell.innerText;
      if (before !== after) {
        _pushUndo(state, [{ cell, before, after }]);
      }
      delete cell.dataset.gmBefore;
    }, true);

    if (opts.dragSelect) {
      on(table, 'mousedown', (e) => {
        const cell = _closestCell(e.target, opts);
        if (!cell) return;
        if (document.activeElement !== cell) e.preventDefault();
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

      on(table, 'dragstart', (e) => {
        if (_closestCell(e.target, opts)) e.preventDefault();
      });

      const mouseupFn = () => { state.dragging = false; };
      document.addEventListener('mouseup', mouseupFn);
      state.listeners.push({ el: document, type: 'mouseup', fn: mouseupFn, cap: false });
    }
  }

  function _handleKeydown(e, state, opts) {
    const active = document.activeElement;
    const cell   = _closestCell(active, opts) || _closestCell(e.target, opts);

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && opts.undoKey) {
      if (state.undoStack.length > 0) { e.preventDefault(); _undo(state); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && opts.undoKey &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      if (state.redoStack.length > 0) { e.preventDefault(); _redo(state); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && opts.copyKey) {
      if (state.selected.size > 1) { e.preventDefault(); _copySelection(state); return; }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && opts.deleteKey) {
      if (['INPUT', 'TEXTAREA'].includes(active?.tagName)) return;
      if (state.selected.size > 1) { e.preventDefault(); _deleteSelection(state); return; }
    }

    if (!cell) return;

    const arrows = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
    if (arrows[e.key]) {
      if (['INPUT','TEXTAREA'].includes(active?.tagName) &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
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
    state.anchor = nextCell;
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
      rows[r][c] = cell.innerText.trim();
    });
    const sorted  = Object.keys(rows).sort((a,b) => a-b);
    const allCols = [...new Set(sorted.flatMap(r => Object.keys(rows[r])))].sort((a,b)=>a-b);
    const tsv = sorted.map(r => allCols.map(c => rows[r][c] ?? '').join('\t')).join('\n');

    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);

    _flashSelection(state, '#b3e5fc');
  }

  function _deleteSelection(state) {
    const snapshots = [];
    state.selected.forEach(cell => {
      const before = cell.innerText.trim();
      if (!before) return;
      const input = cell.querySelector('input');
      if (input) input.value = ''; else cell.innerText = '';
      snapshots.push({ cell, before, after: '' });
    });
    if (!snapshots.length) return;
    state.table.querySelector('tbody')
      ?.dispatchEvent(new Event('input', { bubbles: true }));
    _pushUndo(state, snapshots);
    _flashSelection(state, '#ffcccc');
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
    s.forEach(({ cell, before }) => {
      cell.innerText = before;
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    });
    state.redoStack.push(s);
    _focusSnapshots(state, s);
  }

  function _redo(state) {
    if (!state.redoStack.length) return;
    const s = state.redoStack.pop();
    s.forEach(({ cell, after }) => {
      cell.innerText = after;
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    });
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

window.addEventListener('load', () => {
  document.querySelectorAll('table[data-gm-table]:not([data-gm])').forEach(table => {
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
    [...row.querySelectorAll('td, th')].map(cell => cell.innerText.trim())
  );
}
