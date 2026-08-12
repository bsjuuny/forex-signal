# FX Signal

환율 이력과 기술적 지표를 종합해 원화 기준 주요 통화의 매수·중립·매도 신호를 보여주는 대시보드입니다.

[서비스 바로가기](https://bsjuuny.github.io/forex-signal/)

## 주요 기능

- USD, EUR, JPY, CNY, GBP, CAD, HKD 환율 모니터링
- RSI, EMA, MACD, 볼린저밴드 기반 종합 신호와 강도 계산
- 목표 매수가·매도가·손절가와 스프레드 반영 손익 표시
- 환율 변환, 우대환율, 예상 수익 계산기
- 환율 데이터 갱신과 Telegram 요약 알림
- 정적 사이트 빌드 및 GitHub Pages 자동 배포

## 기술 스택

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
- Lightweight Charts
- 한국수출입은행 환율 API
- GitHub Actions / GitHub Pages

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 주요 명령어

```bash
npm run data:update # 환율 데이터와 신호 갱신
npm run notify      # Telegram 요약 알림
npm run build       # 정적 사이트 빌드
```

데이터 갱신에는 `KOREAEXIM_API_KEY` 등 별도의 환경 변수가 필요합니다.

## 안내

표시되는 신호와 목표가는 참고용이며 금융상품 매매를 권유하지 않습니다.
