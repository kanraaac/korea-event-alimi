# VPS 이전 (Hostinger, Docker)

Aside 루틴 대신 VPS에서 매일 08:00 KST에 같은 다이제스트를 보낸다.
VPS가 24시간 켜져 있으므로 로컬 PC가 꺼져도 발송된다.

## 구조

- `run.mjs` + `src/*.mjs`: 수집→포맷→텔레그램 발송. 의존성 없음(Node 20+ 내장 fetch).
- 컨테이너 안 busybox `crond`가 `0 8 * * *` 실행. `TZ=Asia/Seoul`.
- 사진 없음. 전부 텍스트 + `[ 보기 ]` 링크.

## 소스별 방식

| 종류 | 방식 | 키 |
| --- | --- | --- |
| 예매 7일 | 인터파크 공지 HTML 안 notices JSON 파싱 (재시도 포함) | 불필요 |
| 축제 30일 | 구석구석 달력 JSON API (날짜별 더보기 끝까지) | 불필요 |
| 전시 60일 | 아트큐 + MMCA + SeMA HTML 파싱 | 불필요 |
| 콘서트 60일 | KOPIS Open API (31일씩 2구간 × 대중음악CCCD/클래식CCCA) | KOPIS_KEY |
| 영화 | KOBIS 박스오피스 + 작품정보(장르) | KOBIS_KEY |
| 책 | 예스24 베스트·신간 + 상품페이지(저자·평점·분류) | 불필요 |

## 시크릿 매핑 (값은 절대 저장소에 넣지 말 것)

| .env 변수 | 가져올 곳 |
| --- | --- |
| TELEGRAM_BOT_TOKEN | Aside Vault의 텔레그램 봇 토큰 (또는 루틴 폴더 tg.secret) |
| TELEGRAM_CHAT_ID | `@korea_event_news` (기본값 그대로 두면 됨) |
| KOPIS_KEY | Aside Vault "KOPIS Open API 인증키" |
| KOBIS_KEY | Aside Vault "KOBIS Open API" 키 |

`.env`는 `.gitignore`에 있어서 깃에 안 올라간다.

## 배포 (VPS 셸에서)

```bash
bash <(curl -s https://raw.githubusercontent.com/kanraaac/korea-event-alimi/main/deploy-vps.sh)
# 첫 실행은 .env.example만 복사하고 멈춘다. 아래 파일을 채운다:
nano /docker/korea-event-alimi/.env
# 다시 실행:
bash <(curl -s https://raw.githubusercontent.com/kanraaac/korea-event-alimi/main/deploy-vps.sh)
# 테스트(실발송 없이 로그만):
docker compose -f /docker/korea-event-alimi/docker-compose.yml exec -e DRY_RUN=1 digest node /app/run.mjs
# 실발송 테스트 1회:
docker compose -f /docker/korea-event-alimi/docker-compose.yml exec digest node /app/run.mjs
# 로그:
docker compose -f /docker/korea-event-alimi/docker-compose.yml exec digest tail -n 100 /var/log/digest.log
```

## 운영

- VPS로 옮긴 뒤에는 Aside 루틴(공연전시축제 텔레그램 일정)을 pause한다. 둘 다 켜두면 중복 발송된다.
- 사이트 개편으로 수집건수가 0건으로 떨어지면 로그에 보인다. 파서 위치는 `src/*.mjs` 주석 참고.
- 텔레그램 연속전송 제한(429)은 1.1초 간격 + retry-after 대기로 회피한다.
- KOPIS는 1회 최대 31일이라 60일 창을 2구간으로 나눠 조회한다.
