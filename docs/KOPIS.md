# KOPIS 수집

## 원인 (2달 전량이 안 가던 이유)

1. 웹 목록을 `pblprfrList.do` 로 열면 오류 페이지다. 정상 DB검색은 `pblprfr.do?menuId=MNU_00031`.
2. Open API는 한 번에 **최대 31일**만 조회된다 (결과코드 05). 60일은 `stdate/eddate`를 두 구간으로 나눈다.
3. 페이지당 최대 100건. `cpage`를 올려 받는다.
4. 장르: 대중음악 `CCCD`, 클래식 `CCCA`.

## 요청 예

`http://www.kopis.or.kr/openApi/restful/pblprfr?service={KEY}&stdate=20260918&eddate=20261018&cpage=1&rows=100&shcate=CCCD`

상세: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id=PF301220`
