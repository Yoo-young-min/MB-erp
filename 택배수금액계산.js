// ========================
// 택배 기준값 로드
// ========================
function getBoxStandard() {
  const saved = localStorage.getItem("boxStandard");
  if (saved) return JSON.parse(saved);
  return {
    parcel:  { w:580, d:330, h:320, cbm:0.06125, price:120000 },
    special: { w:460, d:450, h:434.8, cbm:0.09,  price:120000 }
  };
}


// ========================
// 특수품목 지정 택배수
// ========================
function calculateShippingCount() {
  const saved = localStorage.getItem("specialTableData");
  if (!saved) return;
  const specialData = JSON.parse(saved);

  // ★ 9열 지정택배: 품목명 → 택배수 (1:1 매칭이므로 map 사용 OK)
  const map1 = new Map();
  specialData.forEach(sp => {
    const key = (sp[8] || "").trim(), val = (sp[9] || "").trim();
    if (key) map1.set(key, Number(val) || 0);
  });

  // ★ 13열 벌크택배: 같은 품목명이 원본에 따라 택배수가 다름
  //   → originItem(원본품목) + 구성품명 조합으로 매칭
  //   → { "원본품목명|구성품명" : 택배수 } 형태로 저장
  const map2 = new Map();
  specialData.forEach(sp => {
    const origin = (sp[11] || "").trim(); // 12열: 원본품목명
    const detail = (sp[12] || "").trim(); // 13열: 구성품명
    const val    = (sp[13] || "").trim(); // 14열: 택배수
    if (origin && detail) map2.set(origin + "|" + detail, Number(val) || 0);
  });

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const itemCell = row.cells[8], resultCell = row.cells[10];
    if (!itemCell || !resultCell) return;
    const itemText = itemCell.innerText.trim();
    if (!itemText) return;

    // 9열 매칭 먼저
    const val1 = map1.get(itemText);
    if (val1 > 0) { resultCell.textContent = val1; return; }

    // 13열 매칭: originItem + 구성품명 조합으로 정확히 찾기
    const originItem = (row.dataset.originItem || "").trim();
    if (originItem) {
      const val2 = map2.get(originItem + "|" + itemText);
      if (val2 > 0) { resultCell.textContent = val2; return; }
    }

    resultCell.textContent = "";
  });
}


// ========================
// 특수품목 지정 택배 금액
// ========================
function calculateShippingCount2() {
  const saved = localStorage.getItem("specialTableData");
  if (!saved) return;
  const specialData = JSON.parse(saved);

  // 9열 지정택배 금액 map
  const map1 = new Map();
  specialData.forEach(sp => {
    const key = (sp[8] || "").trim(), val = (sp[10] || "").replace(/,/g, "").trim();
    if (key) map1.set(key, Number(val) || 0);
  });

  // 13열 벌크택배 금액: originItem + 구성품명 조합으로 매칭
  const map2 = new Map();
  specialData.forEach(sp => {
    const origin = (sp[11] || "").trim();
    const detail = (sp[12] || "").trim();
    const val    = (sp[14] || "").replace(/,/g, "").trim();
    if (origin && detail) map2.set(origin + "|" + detail, Number(val) || 0);
  });

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const itemCell = row.cells[8], resultCell = row.cells[11];
    if (!itemCell || !resultCell) return;
    const itemText = itemCell.innerText.trim();
    if (!itemText) return;

    // 9열 매칭 먼저
    const val1 = map1.get(itemText);
    if (val1 > 0) { resultCell.textContent = val1.toLocaleString(); return; }

    // 13열 매칭: originItem + 구성품명 조합
    const originItem = (row.dataset.originItem || "").trim();
    if (originItem) {
      const val2 = map2.get(originItem + "|" + itemText);
      if (val2 > 0) { resultCell.textContent = val2.toLocaleString(); return; }
    }

    resultCell.textContent = "";
  });
}


// ========================
// 특수품목 cbm 기준 택배수
// ========================
function calculateShippingRatioCorrect() {
  const saved = localStorage.getItem("specialTableData");
  if (!saved) return;
  const specialData = JSON.parse(saved);

  const excludeSet = new Set();
  const divideMap  = new Map();
  specialData.forEach(sp => {
    const col8 = (sp[7] || "").trim();
    if (col8) excludeSet.add(col8);
    const name = (sp[0] || "").trim(), divide = Number(sp[1]);
    if (name && divide > 0) divideMap.set(name, divide);
  });

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const itemCell = row.cells[8], resultCell = row.cells[10];
    if (!itemCell || !resultCell) return;
    // ★ 이미 택배수가 세팅된 행은 건너뜀
    //   calculateShippingCount()가 먼저 실행되어 값을 넣었으면 덮어쓰지 않음
    if (resultCell.textContent.trim() !== "") return;
    const itemText = itemCell.innerText.trim();
    if (!itemText || excludeSet.has(itemText)) return;
    const match = itemText.replace(/^★/, "").match(/^(.+?)\(([\d,]+)\)$/);
    if (!match) return;
    const divideValue = divideMap.get(match[1].trim());
    if (!divideValue) return;
    const result = Number(match[2].replace(/,/g, "")) / divideValue;
    if (result > 0) resultCell.textContent = Math.max(1, Math.floor(result));
  });

  if (typeof updateGrandTotal === "function") updateGrandTotal();
}


// ========================
// 특수품목 cbm 기준 택배 금액
// ========================
function calculateShippingRatioCorrect2() {
  const saved = localStorage.getItem("specialTableData");
  if (!saved) return;
  const specialData = JSON.parse(saved);

  const excludeSet = new Set();
  const costMap    = new Map();
  specialData.forEach(sp => {
    const col8 = (sp[7] || "").trim();
    if (col8) excludeSet.add(col8);
    const name = (sp[0] || "").trim(), cost = (sp[6] || "").trim();
    if (name && cost) costMap.set(name, cost);
  });

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const itemCell = row.cells[8], resultCell = row.cells[11];
    if (!itemCell || !resultCell) return;
    // ★ 이미 금액이 세팅된 행은 건너뜀
    if (resultCell.textContent.trim() !== "") return;
    const itemText = itemCell.innerText.trim();
    if (!itemText || excludeSet.has(itemText)) return;
    const match = itemText.replace(/^★/, "").match(/^(.+?)\(([\d,]+)\)$/);
    if (!match) return;
    const foundValue = costMap.get(match[1].trim());
    if (foundValue) resultCell.textContent = Number(foundValue.replace(/,/g, "")).toLocaleString();
  });
}


// ========================
// 쇼핑몰(S) 택배수 계산
// ========================
function calculateBoxCount() {
  const productSaved = localStorage.getItem("productListData");
  if (!productSaved) return;
  const productData = JSON.parse(productSaved);
  const BASE_CBM    = getBoxStandard().parcel.cbm;

  const clean = str => (str||"").replace(/^★/,"").replace(/\([^)]*\)$/,"").toLowerCase().trim();
  const productMap = new Map();
  productData.forEach(p => productMap.set(clean(p[0]), p));

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const cells = row.children;
    if (cells.length < 15) return;
    if (!isNaN(parseFloat(cells[10]?.textContent.trim()))) return;
    if ((cells[14].innerText || "").trim() !== "S") return;
    const itemText = cells[8].innerText.trim();
    if (!itemText) return;

    let totalCBM = 0;
    itemText.split("★").filter(v => v.trim()).forEach(item => {
      const match = item.trim().match(/(.+)\(([\d,]+)\)$/);
      if (!match) return;
      const qty = parseFloat(match[2].replace(/,/g, ""));
      const p   = productMap.get(clean(match[1]));
      if (!p) return;
      totalCBM += (parseFloat(String(p[9]).replace(/,/g,""))||0) * qty /
                  (parseFloat(String(p[1]).replace(/,/g,""))||1);
    });
    if (totalCBM > 0) cells[10].textContent = Math.max(1, Math.round(totalCBM / BASE_CBM));
  });
}


// ========================
// 이카운트·쿠팡·스마트(E·C·N) 택배수 계산
// ========================
function calculateBoxCountECN() {
  const productSaved = localStorage.getItem("productListData");
  if (!productSaved) return;
  const productData = JSON.parse(productSaved);
  const BASE_CBM    = getBoxStandard().parcel.cbm;

  const clean = str => (str||"").replace(/^★/,"").replace(/\([^)]*\)$/,"").toLowerCase().trim();
  const productMap = new Map();
  productData.forEach(p => productMap.set(clean(p[3]), p));

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const cells = row.children;
    if (cells.length < 15) return;
    if (!isNaN(parseFloat(cells[10]?.textContent.trim()))) return;
    const type = cells[14].innerText.trim();
    if (!["E","C","N"].includes(type)) return;
    const itemText = cells[8].innerText.trim();
    if (!itemText) return;

    let totalCBM = 0;
    itemText.split("★").filter(v => v.trim()).forEach(item => {
      const match = item.trim().match(/(.+)\(([\d,]+)\)$/);
      if (!match) return;
      const qty = parseFloat(match[2].replace(/,/g, ""));
      const p   = productMap.get(clean(match[1]));
      if (!p) return;
      totalCBM += (parseFloat(String(p[9]).replace(/,/g,""))||0) * qty /
                  (parseFloat(String(p[1]).replace(/,/g,""))||1);
    });
    if (totalCBM > 0) cells[10].textContent = Math.max(1, Math.round(totalCBM / BASE_CBM));
  });
}


// ========================
// 일반품목 택배비 계산
// ========================
function calculateBoxCost() {
  const productSaved = localStorage.getItem("productListData");
  const costSaved    = localStorage.getItem("택배비기준표");
  if (!productSaved || !costSaved) return;

  const productData = JSON.parse(productSaved);
  const costData    = JSON.parse(costSaved);

  const clean = str => (str||"").replace(/^★/,"").replace(/\([^)]*\)$/,"").toLowerCase().trim();
  const productMapS   = new Map();
  const productMapECN = new Map();
  productData.forEach(p => { productMapS.set(clean(p[0]),p); productMapECN.set(clean(p[3]),p); });

  // 화물/화택/일반 각각 정렬 (0 제외)
  const sortedParcel  = [...costData].sort((a,b)=>a.cbm-b.cbm).filter(c=>c.택배>0);
  const sortedCargo   = [...costData].sort((a,b)=>a.cbm-b.cbm).filter(c=>c.화물>0);
  const sortedCargoEx = [...costData].sort((a,b)=>a.cbm-b.cbm).filter(c=>c.화물택배>0);

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const cells = row.children;
    if (cells.length < 15) return;
    const type = cells[14].innerText.trim();
    if (!["S","E","C","N"].includes(type)) return;
    const itemText = cells[8].innerText.trim();
    if (!itemText) return;

    // 화물/화택 여부 판단
    const isCargo   = cells[2]?.innerText.trim() === "화물";
    const isCargoEx = cells[3]?.innerText.trim() === "화택";

    // ★ 일반 행은 단가 있으면 건너뜀, 화물/화택 행은 강제 재계산
    if (!isCargo && !isCargoEx && (cells[11]?.textContent.replace(/,/g,"").trim()) !== "") return;

    const productMap = type === "S" ? productMapS : productMapECN;
    let totalCBM = 0;
    itemText.split("★").filter(v => v.trim()).forEach(item => {
      const match = item.trim().match(/(.+)\(([\d,]+)\)$/);
      if (!match) return;
      const qty = parseFloat(match[2].replace(/,/g,""));
      const p   = productMap.get(clean(match[1]));
      if (!p) return;
      totalCBM += (parseFloat(String(p[9]).replace(/,/g,""))||0) * qty /
                  (parseFloat(String(p[1]).replace(/,/g,""))||1);
    });
    if (totalCBM <= 0) return;

    // 화물/화택/일반에 따라 다른 단가 적용
    let sorted, key;
    if (isCargo)        { sorted = sortedCargo;   key = "화물"; }
    else if (isCargoEx) { sorted = sortedCargoEx; key = "화물택배"; }
    else                { sorted = sortedParcel;  key = "택배"; }

    const found = sorted.find(c => totalCBM <= c.cbm) || sorted[sorted.length-1];
    if (found) cells[11].textContent = found[key].toLocaleString();
  });
}


// ========================
// 선불 / 착불 계산
// ========================
function calculatePaymentType() {
  const BASE_PRICE = getBoxStandard().parcel.price;

  const middleRaw  = localStorage.getItem("middleProductData");
  const middleSet  = new Set(
    (middleRaw ? JSON.parse(middleRaw) : []).map(r => (r[0]||"").trim()).filter(v => v)
  );

  const ecountRaw  = localStorage.getItem("sendListData_(이)주문");
  const ecountAmountMap = new Map();
  (ecountRaw ? JSON.parse(ecountRaw) : []).forEach(item => {
    const key    = (item.name||"")+"|"+(item.mobile||"")+"|"+(item.addr||"");
    const amount = parseFloat((item.amount||"0").replace(/,/g,"")) || 0;
    ecountAmountMap.set(key, (ecountAmountMap.get(key)||0) + amount);
  });

  const groupRows = new Map();

  document.querySelectorAll("#orderTable tr").forEach(row => {
    const cells = row.children;
    if (cells.length < 15) return;
    const type   = (cells[14]?.innerText||"").trim();
    if (!type) return;
    const name   = (cells[4]?.innerText||"").trim();
    const mobile = (cells[5]?.innerText||"").trim();
    const addr   = (cells[7]?.innerText||"").trim();

    if (middleSet.has(name)) {
      cells[12].textContent = "착불";
      cells[12].style.color = "red";
      cells[12].style.fontWeight = "normal";
      return;
    }
    if (["S","C","N"].includes(type)) {
      cells[12].textContent = "선불";
      cells[12].style.color = "";
      cells[12].style.fontWeight = "";
      return;
    }
    if (type === "E") {
      const key = name+"|"+mobile+"|"+addr;
      if (!groupRows.has(key)) groupRows.set(key, []);
      groupRows.get(key).push(row);
    }
  });

  groupRows.forEach((rowList, key) => {
    const total = ecountAmountMap.get(key) || 0;
    const label = total >= BASE_PRICE ? "선불" : "착불";
    rowList.forEach(row => {
      row.children[12].textContent      = label;
      row.children[12].style.color      = label === "착불" ? "red" : "";
      row.children[12].style.fontWeight = label === "착불" ? "normal" : "";
    });
  });
}