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
    "K-떡": ["떡 수출", "K-떡", "쌀가공식품 수출", "한국 떡 해외"],
    "제지·포장": ["제지 가격 인상", "골판지 가격", "백판지", "포장재 가격"],
}
# ── 기사 '제목'에 이 단어 중 하나는 꼭 있어야 들어와요 (본문에만 있는 기사는 빼요) ──
MUST = {
    "떡·쌀": ["떡", "쌀", "찹쌀", "방앗간"],
    "K-떡": ["떡", "쌀가공"],
    "제지·포장": ["제지", "종이", "골판지", "백판지", "판지", "펄프", "포장재", "포장", "박스", "상자"],
}
NEWS_PER_CAT = 4
NEWS_DAYS = 21                      # 3주 지난 기사는 빼요
# ── 제목에 이 단어가 있으면 빼요 ──
EXCLUDE = ["떡볶이", "떡상", "떡락", "떡잎", "떡밥", "떡실신", "떡칠", "떡진", "주가", "코인", "시계"]
PRESS = {"yna.co.kr": "연합뉴스", "newsis.com": "뉴시스", "news1.kr": "뉴스1", "mk.co.kr": "매일경제",
         "hankyung.com": "한국경제", "chosun.com": "조선일보", "joongang.co.kr": "중앙일보", "donga.com": "동아일보",
         "hani.co.kr": "한겨레", "khan.co.kr": "경향신문", "sedaily.com": "서울경제", "edaily.co.kr": "이데일리",
         "mt.co.kr": "머니투데이", "mtn.co.kr": "MTN", "fnnews.com": "파이낸셜뉴스", "heraldcorp.com": "헤럴드경제",
         "heraldk.com": "헤럴드경제", "asiae.co.kr": "아시아경제", "nongmin.com": "농민신문", "kbs.co.kr": "KBS",
         "imbc.com": "MBC", "sbs.co.kr": "SBS", "ytn.co.kr": "YTN", "biz.sbs.co.kr": "SBS Biz",
         "dealsite.co.kr": "딜사이트", "etnews.com": "전자신문", "kukinews.com": "쿠키뉴스", "imaeil.com": "매일신문",
         "kyeongin.com": "경인일보", "newspim.com": "뉴스핌", "bizwatch.co.kr": "비즈워치", "foodnews.co.kr": "식품음료신문",
         "thinkfood.co.kr": "식품저널", "foodbank.co.kr": "식품외식경제", "aflnews.co.kr": "농수축산신문"}

# ── 원재료 시세 (KAMIS 소매가격, 전국 평균) ──
#    [화면에 보일 이름, 품목 이름에 들어갈 말, 품종 이름에 들어갈 말(없으면 "")]  ※ 단위(20kg 등)는 자동으로 붙어요
SISE_ITEMS = [
    ["쌀",          "쌀",   "20kg"],
    ["찹쌀",        "찹쌀", ""],
    ["붉은팥(국산)", "팥",   "국산"],
]

def get(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "makebox-today/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def get_retry(urls, tries=3, timeout=60):
    """느린 서버용: 주소 여러 개(https/http)를 번갈아 최대 tries번씩 시도"""
    import time
    last = None
    for t in range(tries):
        for u in urls:
            try:
                return get(u, timeout=timeout)
            except Exception as e:
                last = e
        time.sleep(5)
    raise last

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
                if not any(x in title for x in MUST.get(cat, [""])): continue
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

# ───────── 원재료 시세 (공공데이터포털 · aT 일별 도·소매 가격) ─────────
# 기상청과 같은 공공데이터포털 열쇠(KMA_KEY)를 같이 써요.
SISE_CODES = {"쌀": "111", "찹쌀": "112", "팥": "142", "콩": "141", "녹두": "143"}

def sise():
    key = os.environ.get("KMA_KEY", "").strip()
    if not key:
        print("공공데이터 키 없음 → 시세 건너뜀"); return
    k = key if "%" in key else urllib.parse.quote(key, safe="")
    end_d = now.date(); start_d = end_d - timedelta(days=45)
    def pick(row, names):
        for n in names:
            if n in row and str(row[n]).strip() not in ("", "-", "None"): return str(row[n]).strip()
        return ""
    def num(x):
        try: return float(str(x).replace(",", "").strip())
        except Exception: return None
    out, last_day, debug = [], "", None
    for label, iname, kname in SISE_ITEMS:
        code = SISE_CODES.get(iname)
        if not code:
            print("시세 품목코드 없음:", iname); continue
        rows = []
        for page in range(1, 6):
            url = ("https://apis.data.go.kr/B552845/perDay/price?serviceKey=" + k +
                   "&returnType=json&pageNo=%d&numOfRows=1000" % page +
                   "&cond%5Bexmn_ymd%3A%3AGTE%5D=" + start_d.strftime("%Y%m%d") +
                   "&cond%5Bexmn_ymd%3A%3ALTE%5D=" + end_d.strftime("%Y%m%d") +
                   "&cond%5Bctgry_cd%3A%3AEQ%5D=100&cond%5Bitem_cd%3A%3AEQ%5D=" + code)
            try:
                txt = get(url, timeout=40)
                d = json.loads(txt)
            except Exception as e:
                print("시세 실패", label, e, (locals().get("txt") or "")[:150]); break
            body = d.get("response", {}).get("body", {}) if isinstance(d, dict) else {}
            it = body.get("items", {})
            it = it.get("item", []) if isinstance(it, dict) else it
            if isinstance(it, dict): it = [it]
            if not it:
                if page == 1: print("시세 자료 없음", label, str(d)[:200])
                break
            rows += it
            total = num(body.get("totalCount")) or 0
            if len(rows) >= total: break
        if not rows: continue
        debug = debug or rows[0]
        # 소매 + 품종 + 상품 등급만
        def ok(r, need_grade):
            se = pick(r, ["se_nm", "se_cd"])
            if se and not ("소매" in se or se in ("01", "1")): return False
            if kname and kname not in pick(r, ["vrty_nm", "kind_nm"]): return False
            if need_grade and "상품" not in pick(r, ["grd_nm", "rank_nm"]): return False
            return True
        sel = [r for r in rows if ok(r, True)] or [r for r in rows if ok(r, False)]
        by = {}
        for r in sel:
            p = num(pick(r, ["exmn_dd_prc", "exmn_dd_avg_prc", "prc"]))
            dt = pick(r, ["exmn_ymd"]).replace("-", "")
            if p and dt: by.setdefault(dt, []).append(p)
        if not by:
            print("시세 품목 못 찾음:", label, "| 예시 줄:", json.dumps(rows[0], ensure_ascii=False)[:300]); continue
        days = sorted(by)
        latest = days[-1]
        avg = lambda dt: sum(by[dt]) / len(by[dt])
        now_p = round(avg(latest))
        ld = datetime.strptime(latest, "%Y%m%d").date()
        old = [x for x in days if datetime.strptime(x, "%Y%m%d").date() <= ld - timedelta(days=28)]
        diff = "-"
        if old:
            mon_p = avg(old[-1]); r = (now_p - mon_p) / mon_p * 100
            diff = "-" if abs(r) < 0.05 else ("▲" if r > 0 else "▼") + "%.1f%%" % abs(r)
        unit = (pick(sel[0], ["unit_sz"]) + pick(sel[0], ["unit"])).strip() if sel else ""
        out.append([label + (" (%s)" % unit if unit else ""), "{:,}원".format(now_p), diff])
        last_day = max(last_day, latest)
    if out:
        data["sise"] = out
        data["sise_time"] = "%d.%d" % (int(last_day[4:6]), int(last_day[6:8]))
        print("시세", len(out), "품목")
    elif debug:
        print("시세 예시 줄:", json.dumps(debug, ensure_ascii=False)[:400])

weather()
news()
sise()
data["updated"] = now.strftime("%Y-%m-%d %H:%M")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장:", OUT)
