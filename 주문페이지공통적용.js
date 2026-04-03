// ========================
// 전체 주문 초기화 — (쇼)주문.html 의 resetAllOrders() 사용
// ========================


// ========================
// 공통: 실수량 계산
// ========================
function calculateRealQtyCommon() {
  const data = JSON.parse(localStorage.getItem("productListData") || "[]");
  const productMap = {};
  data.forEach(row => {
    const name = (row[0] || "").trim().toLowerCase().replace(/\s+/g,"");
    const unit = parseFloat((row[1] || "0").replace(/,/g,""));
    if (name && !isNaN(unit)) productMap[name] = unit;
  });
  document.querySelectorAll("#orderTable tr").forEach(row => {
    const productCell = row.cells[4], qtyCell = row.cells[5], realCell = row.cells[9];
    if (!productCell || !qtyCell || !realCell) return;
    const productName = (productCell.innerText || "").trim().toLowerCase().replace(/\s+/g,"");
    let qty = parseFloat((qtyCell.innerText || "").replace(/,/g,""));
    if (isNaN(qty)) qty = 0;
    realCell.innerText = (productMap[productName] && qty > 0)
      ? (qty * productMap[productName]).toLocaleString() : "";
  });
}


// ========================
// ★ TSV 파서 — 엑셀 셀 내 줄바꿈(\n) → 공백으로 치환
// ========================
function parseTSV(raw) {
  var rows=[], row=[], cell="", inQuote=false;
  for(var i=0;i<raw.length;i++){
    var ch=raw[i];
    if(inQuote){
      if(ch==='"'){
        if(raw[i+1]==='"'){ cell+='"'; i++; }
        else inQuote=false;
      } else if(ch==='\n'||ch==='\r'){
        cell+=' '; // 셀 내 줄바꿈 → 공백
      } else {
        cell+=ch;
      }
    } else {
      if(ch==='"'){ inQuote=true; }
      else if(ch==='\t'){ row.push(cell.trim()); cell=""; }
      else if(ch==='\r'){}
      else if(ch==='\n'){ row.push(cell.trim()); cell=""; rows.push(row); row=[]; }
      else { cell+=ch; }
    }
  }
  if(cell.trim()||row.length>0){ row.push(cell.trim()); rows.push(row); }
  return rows;
}


// ========================
// 공통 이벤트 등록
// ★ 이벤트 중복 등록 방지 — 한 번만 등록
// ========================
var _commonEventsInited = false;

function initCommonEvents() {
  const tbody = document.getElementById("orderTable");
  if (!tbody) return;

  // ★ 이미 등록됐으면 건너뜀 (pageshow/focus 재호출 시 중복 방지)
  if (tbody.dataset.commonInited === "true") return;
  tbody.dataset.commonInited = "true";

  // blur → 콤마 포맷 + 실수량 계산
  tbody.addEventListener("blur", function(e) {
    if (e.target.tagName !== "TD") return;
    const col = e.target.cellIndex;
    if ([5,6,7,9].includes(col)) {
      let v = e.target.innerText.replace(/,/g,"").trim();
      if (v !== "" && !isNaN(v)) e.target.innerText = Number(v).toLocaleString();
    }
    calculateRealQtyCommon();
  }, true);

  // input → 실수량 계산
  tbody.addEventListener("input", function() {
    calculateRealQtyCommon();
  });

  // ★ paste → parseTSV 사용 (셀 내 줄바꿈 처리)
  tbody.addEventListener("paste", function(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const startCell = document.activeElement;
    if (!startCell || startCell.tagName !== "TD") return;
    const startRow = startCell.parentElement.rowIndex - 1;
    const startCol = startCell.cellIndex;

    const parsedRows = parseTSV(text);

    // 필요한 행 수 확보
    while (tbody.rows.length < startRow + parsedRows.length) {
      const newRow = tbody.insertRow();
      for (let j = 0; j < tbody.rows[0].cells.length; j++) {
        const cell = newRow.insertCell();
        cell.contentEditable = "true";
      }
    }

    parsedRows.forEach((cols, i) => {
      const row = tbody.rows[startRow + i];
      if (!row) return;
      cols.forEach((colText, j) => {
        const cell = row.cells[startCol + j];
        if (cell) cell.innerText = colText;
      });
    });

    setTimeout(() => { calculateRealQtyCommon(); }, 50);
  });
}


// ========================
// 공통 초기화
// ========================
function initCommon() {
  initCommonEvents();
  calculateRealQtyCommon();
}

window.addEventListener("load", initCommon);
window.addEventListener("pageshow", initCommon);
window.addEventListener("focus", initCommon);