# -*- coding: utf-8 -*-
"""오늘의 메이크박스 — 기상청 단기예보 + 네이버 뉴스 검색 → flipbook/today-data.json
   (외부 라이브러리 없이 동작)"""
import json, os, re, html, urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone

OUT = "flipbook/today-data.json"
KST = timezone(timedelta(hours=9))
now = datetime.now(KST)

# ── 지역 (기상청 격자 nx, ny) ── 순서대로 화면에서 돌아가요
REGIONS = [
    ("서울·경기", 60, 127), ("인천", 55, 124), ("강원 영서", 73, 134), ("강원 영동", 92, 131),
    ("충북", 69, 106), ("충남·대전", 67, 100), ("전북", 63, 89), ("전남·광주", 58, 74),
    ("경북·대구", 89, 90), ("경남·부산", 98, 76), ("울산", 102, 84), ("제주", 52, 38),
]
# ── 뉴스 검색어 (분야: 검색어들) ──
NEWS_Q = {
    "떡·쌀": ["떡집", "떡 가격", "쌀값", "찹쌀 가격"],
    "K-떡": ["떡 수출", "K-떡", "떡볶이 수출", "쌀가공식품 수출", "한국 떡 해외"],
    "제지·포장": ["제지 가격 인상", "골판지 가격", "백판지", "포장재 가격"],
}
NEWS_PER_CAT = 4
NEWS_DAYS = 21                      # 3주 지난 기사는 빼요
EXCLUDE = ["떡상", "떡락", "떡잎", "떡밥", "떡실신", "주가", "코인"]
PRESS = {"yna.co.kr": "연합뉴스", "newsis.com": "뉴시스", "news1.kr": "뉴스1", "mk.co.kr": "매일경제",
         "hankyung.com": "한국경제", "chosun.com": "조선일보", "joongang.co.kr": "중앙일보", "donga.com": "동아일보",
         "hani.co.kr": "한겨레", "khan.co.kr": "경향신문", "sedaily.com": "서울경제", "edaily.co.kr": "이데일리",
         "mt.co.kr": "머니투데이", "mtn.co.kr": "MTN", "fnnews.com": "파이낸셜뉴스", "heraldcorp.com": "헤럴드경제",
         "heraldk.com": "헤럴드경제", "asiae.co.kr": "아시아경제", "nongmin.com": "농민신문", "kbs.co.kr": "KBS",
         "imbc.com": "MBC", "sbs.co.kr": "SBS", "ytn.co.kr": "YTN", "biz.sbs.co.kr": "SBS Biz",
         "dealsite.co.kr": "딜사이트", "etnews.com": "전자신문", "kukinews.com": "쿠키뉴스", "imaeil.com": "매일신문",
         "kyeongin.com": "경인일보", "newspim.com": "뉴스핌", "bizwatch.co.kr": "비즈워치", "foodnews.co.kr": "식품음료신문",
         "thinkfood.co.kr": "식품저널", "foodbank.co.kr": "식품외식경제", "aflnews.co.kr": "농수축산신문"}

def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "makebox-today/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")

old = {}
if os.path.exists(OUT):
    try: old = json.load(open(OUT, encoding="utf-8"))
    except Exception: old = {}
data = dict(old)

# ───────── 날씨 ─────────
def weather():
    key = os.environ.get("KMA_KEY", "").strip()
    if not key:
        print("KMA_KEY 없음 → 날씨 건너뜀"); return
    k = key if "%" in key else urllib.parse.quote(key, safe="")
    # 발표시각 02,05,08,11,14,17,20,23시 (+15분 뒤 사용 가능)
    t = now - timedelta(minutes=15)
    bases = [2, 5, 8, 11, 14, 17, 20, 23]
    h = max([b for b in bases if b <= t.hour], default=None)
    bd = t if h is not None else t - timedelta(days=1)
    h = 23 if h is None else h
    base_date, base_time = bd.strftime("%Y%m%d"), "%02d00" % h
    target = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    out = []
    for name, nx, ny in REGIONS:
        url = ("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=" + k +
               "&pageNo=1&numOfRows=200&dataType=JSON&base_date=%s&base_time=%s&nx=%d&ny=%d" % (base_date, base_time, nx, ny))
        try:
            items = json.loads(get(url))["response"]["body"]["items"]["item"]
        except Exception as e:
            print("날씨 실패", name, e); continue
        by = {}
        for it in items:
            by.setdefault(it["fcstDate"] + it["fcstTime"], {})[it["category"]] = it["fcstValue"]
        keys = sorted(by)
        want = target.strftime("%Y%m%d%H00")
        pick = next((x for x in keys if x >= want and "TMP" in by[x]), keys[0] if keys else None)
        if not pick: continue
        v = by[pick]
        pty, sky = v.get("PTY", "0"), v.get("SKY", "1")
        txt = {"1": "비", "2": "비/눈", "3": "눈", "4": "소나기"}.get(pty) or {"1": "맑음", "3": "구름많음", "4": "흐림"}.get(sky, "맑음")
        try: tmp = round(float(v.get("TMP")))
        except Exception: continue
        out.append([name, txt, tmp])
    if out:
        data["weather"] = out
        data["wx_time"] = "%d/%d %d시 발표" % (bd.month, bd.day, h)
        print("날씨", len(out), "곳")

# ───────── 업계 소식 ─────────
def news():
    cid, sec = os.environ.get("NAVER_ID", "").strip(), os.environ.get("NAVER_SECRET", "").strip()
    if not (cid and sec):
        print("NAVER 키 없음 → 소식 건너뜀"); return
    # 2026.7월부터 네이버 검색 API는 네이버 클라우드 'NAVER API HUB'로 옮겨졌어요
    hd = {"X-NCP-APIGW-API-KEY-ID": cid, "X-NCP-APIGW-API-KEY": sec, "User-Agent": "makebox-today/1.0"}
    cut = now - timedelta(days=NEWS_DAYS)
    seen, result = set(), []
    for cat, qs in NEWS_Q.items():
        pool = []
        for q in qs:
            try:
                items = json.loads(get("https://naverapihub.apigw.ntruss.com/search/v1/news?display=20&sort=date&query=" +
                                       urllib.parse.quote(q), hd))["items"]
            except Exception as e:
                print("소식 실패", q, e); continue
            for it in items:
                title = html.unescape(re.sub(r"<[^>]+>", "", it["title"])).strip()
                if any(x in title for x in EXCLUDE): continue
                norm = re.sub(r"[^가-힣A-Za-z0-9]", "", title)[:24]
                if norm in seen: continue
                try: dt = datetime.strptime(it["pubDate"], "%a, %d %b %Y %H:%M:%S %z").astimezone(KST)
                except Exception: continue
                if dt < cut: continue
                link = it.get("originallink") or it.get("link")
                host = urllib.parse.urlparse(link).netloc.replace("www.", "").replace("m.", "", 1) if link else ""
                press = next((v for k2, v in PRESS.items() if host.endswith(k2)), host)
                seen.add(norm)
                pool.append((dt, [cat, title, press, dt.strftime("%Y-%m-%d"), link]))
        pool.sort(key=lambda x: x[0], reverse=True)
        result += pool[:NEWS_PER_CAT]
    if result:
        result.sort(key=lambda x: x[0], reverse=True)
        data["news"] = [r for _, r in result]
        data["news_time"] = now.strftime("%-m/%-d %H시")
        print("소식", len(result), "건")

weather()
news()
data["updated"] = now.strftime("%Y-%m-%d %H:%M")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장:", OUT)
