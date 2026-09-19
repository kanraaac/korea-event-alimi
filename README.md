# 대한민국공연알리미

매일 08:00 KST에 전국 공연·전시·축제·영화·도서 일정을 텔레그램 봇 `@koreaeventalimi_bot`으로 보낸다.

Aside 루틴 id: `zSKlg6WaBidBtWVY`

## 메시지 창

| 종류 | 기간 | 비고 |
| --- | --- | --- |
| 예매 오픈 | 오늘 ~ +7일 | 인터파크/예스24/멜론/티켓링크 공지 |
| 지역축제 | 오늘 ~ +30일 | 구석구석 달력, 시·도 권역별, 일정 빠른 순 |
| 전시·미술 | 오늘 ~ +15일 | 아트큐+MMCA+SeMA+리움/호암+아르코, 5개 권역 |
| 콘서트·음악 | 오늘 ~ +15일 | KOPIS DB검색 `pblprfr.do` + Open API(31일 분할) |
| 영화 | 전일 박스오피스 | KOBIS, 소개 링크는 네이버 검색 |
| 도서 | 신간·베스트 20 | 예스24, 분류·평점 |

링크 라벨은 전부 `[ 보기 ]`. 원문 URL은 본문에 넣지 않는다.

## KOPIS 수집 주의

- 웹 목록 URL `.../pblprfrList.do` 는 오류 페이지다. `.../pblprfr.do?menuId=MNU_00031` 을 쓴다.
- Open API `http://www.kopis.or.kr/openApi/restful/pblprfr` 는 **최대 31일**, 페이지당 **최대 100건**. 2달은 월 단위로 나눠 조회한다.

## 시크릿

봇 토큰·API 키는 저장소에 넣지 않는다. Aside Vault / 루틴 `tg.secret` 만 사용.

## VPS 이전

매일 08:00 발송을 Hostinger VPS로 옮기는 방법이 `docs/VPS.md` 에 있다.
`package.json`, `Dockerfile`, `docker-compose.yml`, `deploy-vps.sh`, `run.mjs`, `src/` 가 그 프로젝트다.
VPS에서 돌아가면 Aside 루틴은 pause 한다(중복 방지).
