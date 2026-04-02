// ============================
// 택배비 계산 엔진
// ============================

function 택배비계산(cbm값, 발송방법){

    const 기준표 = JSON.parse(localStorage.getItem("택배비기준표"));

    if(!기준표 || 기준표.length === 0){
        alert("택배비 기준표가 없습니다.");
        return 0;
    }

    for(let i = 0; i < 기준표.length; i++){
        if(cbm값 <= 기준표[i].cbm){
            return 기준표[i][발송방법] || 0;
        }
    }

    // 모든 기준 초과하면 마지막 금액
    const 마지막 = 기준표[기준표.length - 1];
    return 마지막[발송방법] || 0;
}