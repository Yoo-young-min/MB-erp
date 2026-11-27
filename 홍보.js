// ★ 홍보물(카탈로그·포스터·전단 등) 동봉 표시 — 포장.html 전용
//   - [홍보물 동봉 중] 체크 시: 이번 시즌 처음 받는 고객은 순번 대신 '홍보' 표시
//   - 체크 해제 시: 평소처럼 순번만 표시
//   - 인쇄할 때 '홍보' 표시된 고객을 "받음"으로 기록 (이 PC 브라우저에만 저장, 외부 전송 없음)
//   - 순번 칸 클릭: '홍보' 끄기(받지 않을 고객) ↔ 다시 켜기
//   - [새 시즌 시작]: 기록을 비우고 처음부터
//   * 이 기능을 없애려면 포장.html 맨 아래 홍보.js 불러오는 줄 하나만 지우면 됨
(function(){
  const ON_KEY="promoOn", SENT_KEY="promoSent";
  const today=()=>{const t=new Date(),p=v=>String(v).padStart(2,"0");return t.getFullYear()+"-"+p(t.getMonth()+1)+"-"+p(t.getDate());};
  const isOn=()=>localStorage.getItem(ON_KEY)==="1";
  const loadSent=()=>{try{return JSON.parse(localStorage.getItem(SENT_KEY)||"{}");}catch(e){return {};}};
  const saveSent=m=>localStorage.setItem(SENT_KEY,JSON.stringify(m));
  const custKey=d=>{
    const m=(d.mobile||"").replace(/\D/g,""); if(m.length>=9) return m;
    const t=(d.tel||"").replace(/\D/g,"");    if(t.length>=9) return t;
    return ((d.name||"")+"|"+(d.addr||"")).replace(/\s+/g,"");
  };
  let rowInfo=[];

  // ── 상단 스위치 / 상태 표시 ──
  function buildUI(){
    const st=document.createElement("style");
    st.textContent="#promoBox{display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;"+
      "width:794px;margin:8px auto 0 auto;padding:4px 10px;box-sizing:border-box;"+
      "background:#fff5f5;border:1px solid #f5c2c7;border-radius:4px;}"+
      "#promoBox button{font-size:11px;padding:3px 8px;cursor:pointer;}"+
      ".promo-mark{color:#d00;font-weight:bold;font-size:9px;white-space:nowrap;}"+
      "@media print{#promoBox{display:none !important;}}";
    document.head.appendChild(st);
    const box=document.createElement("div"); box.id="promoBox";
    box.innerHTML='<label style="cursor:pointer;"><input type="checkbox" id="promoChk"> <b>홍보물 동봉 중</b></label>'+
      '<span id="promoInfo" style="color:#d00;"></span>'+
      '<button type="button" id="promoReset">새 시즌 시작</button>';
    const title=document.querySelector("h1");
    if(title) title.parentNode.insertBefore(box,title); else document.body.prepend(box); // 타이틀 '포장' 위 한 줄
    const chk=document.getElementById("promoChk");
    chk.checked=isOn();
    chk.addEventListener("change",()=>{ localStorage.setItem(ON_KEY,chk.checked?"1":"0"); render(); });
    document.getElementById("promoReset").addEventListener("click",()=>{
      if(!confirm("홍보물 받은 고객 기록을 모두 지우고 새 시즌을 시작할까요?")) return;
      saveSent({}); render();
    });
  }

  // ── 순번 칸 표시 ──
  function render(){
    let data=[]; try{data=JSON.parse(localStorage.getItem("packData")||"[]");}catch(e){}
    const on=isOn(), sent=loadSent(), d=today(), seen=new Set(); let n=0; rowInfo=[];
    document.querySelectorAll("#orderTable tr").forEach((row,i)=>{
      const c=row.cells[0]; if(!c) return;
      const it=data[i]; let show=false, k=null, r="";
      if(on&&it&&(it.name||it.item)){
        k=custKey(it); r=String(it.round||"");
        const s=sent[k];
        show=!seen.has(k)&&(!s||(s.d===d&&s.r===r)); // 미수령 or 오늘 같은 회차(재인쇄)
        seen.add(k);
      }
      rowInfo[i]=k?{k,r,show}:null;
      if(show){ c.innerHTML='<span class="promo-mark">홍보</span>'; n++; }
      else if(c.textContent!==String(i+1)) c.textContent=i+1;
    });
    const info=document.getElementById("promoInfo");
    if(info) info.textContent=on?("이번 회차 "+n+"건 · 누적 기록 "+Object.keys(sent).length+"명"):"";
  }

  // ── 인쇄 시 기록 ──
  window.addEventListener("beforeprint",function(){
    if(!isOn()) return;
    const sent=loadSent(), d=today();
    rowInfo.forEach(ri=>{ if(ri&&ri.show&&!sent[ri.k]) sent[ri.k]={d,r:ri.r}; });
    saveSent(sent);
  });

  // ── 순번 칸 클릭: 홍보 끄기/켜기 ──
  document.addEventListener("click",function(e){
    if(!isOn()) return;
    const td=e.target.closest&&e.target.closest("#orderTable td"); if(!td||td.cellIndex!==0) return;
    const ri=rowInfo[td.parentElement.rowIndex-1]; if(!ri) return;
    const sent=loadSent();
    if(ri.show) sent[ri.k]={d:"제외",r:""}; else delete sent[ri.k];
    saveSent(sent); render();
  });

  window.addEventListener("load",function(){ buildUI(); render(); });
  window.addEventListener("focus",render);
  window.addEventListener("pageshow",render);
})();
