// ===============================
// 공통 하단 네비게이션 (버튼3)
// ===============================

(function () {

  const navHTML = `
  <div class="bottom-nav3">
    <div class="nav-container3">
      <button onclick="goPage3('택배기준관리')">택배기준관리</button>
      <button onclick="goPage3('택배비부피별기준')">택배비부피별기준</button>
    </div>
  </div>
  `;

  const style = `
  <style>

  .bottom-nav3 {       /* 회색바 조정 */
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 50px;          /* 회색바 높이 */
    background: #f4f4f4;
    display: flex;
    justify-content: center;
    align-items: center;   /* 버튼을 중앙에 */
  }

  
  .nav-container3 {
    display: flex;
    gap: 20px;
  }

  .bottom-nav3 button {    /* 버튼 조정 */
  background-color: #d6ebf5;
  color: black;
  border: none;
  font-size: 14px;
  font-weight: 400;
  padding: 10px 14px;  /*버튼 높이 조정 */
  border-radius: 4px;
  cursor: pointer;
  margin: 0;   /* 🔥 추가 */
}

  .bottom-nav3 button:hover {
    opacity: 0.85;
  }

  /* 인쇄시 숨김 */
  @media print {
    .bottom-nav3 {
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

function goPage3(page) {

  const pageMap = {
    "택배기준관리": "택배기준관리.html",
    "택배비부피별기준": "택배비부피별기준.html"
  };

  location.href = pageMap[page];

}