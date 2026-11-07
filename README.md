# ShipOne — 끝났나요?

오늘 끝낼 하나를 고르고, 결과물로 마무리를 확인하는 AI 도깨비. OBA Weekendthon 2026 신규 프로젝트입니다.

- 웹앱: https://itgoblin-develop.github.io/shipone-oba-2026/
- 발표자료: https://itgoblin-develop.github.io/shipone-oba-2026/pitch/
- 60초 영상: https://itgoblin-develop.github.io/shipone-oba-2026/video/
- MP4: https://itgoblin-develop.github.io/shipone-oba-2026/media/shipone-demo-60s.mp4

## 바로 체험

로그인·키 입력 없이 엽니다. **오늘의 하나 골라줘**는 실제 OpenAI를 호출합니다. **샘플 시나리오 체험**은 API 없이 재현 가능한 완료 검증 흐름을 보여줍니다. **내 작업으로 돌아가기**에서 자기 할 일과 일정을 추가합니다.

계획 확인 → 집중 시작 → 결과물 제출 → 누락 검사 → 수정 → 완료 기록. 오른쪽 아래 도깨비를 눌러 작업에 대해 질문하거나 기기 음성을 켤 수 있습니다.

## 구현

- PC·모바일 반응형 React 웹앱, 기기 내 브라우저 저장
- 연속된 빈 시간·우선순위·에너지에 맞는 작업 후보 선정
- OpenAI Responses API, gpt-6.1-sol, 구조화된 실행 단계·완료 조건·막힘 제안
- 플로팅 도깨비, 맥락을 전달하는 AI 질문, 선택형 기기 TTS
- 집중 시간 종료·완료 알림 (권한을 켜고 웹앱이 열려 있을 때)
- 텍스트/직접 선택한 파일의 문구·분량 검사와 사용자 확인 분리
- 수정 시 기존 통과 무효화, SHA-256·검사 시점·완료 기록, Markdown 내보내기
- 일정 JSON 가져오기, Google Calendar·Notion 연결 버튼과 준비 중 안내

문구·분량 검사는 기능 정상 동작이나 품질 전체를 보증하지 않습니다. 주관적 결과는 사용자 확인으로 남깁니다. 웹 공개 URL 자동 검사는 제공하지 않습니다.

## 데이터와 배포

화면은 GitHub Pages, API는 Cloudflare Worker 기반 Sites 서버입니다. OpenAI 키는 서버 비밀값이며 저장소·브라우저에 포함하지 않습니다. store:false로 요청합니다. 추천에는 작업·시간·최근 완료 요약, 질문에는 현재 작업과 질문이 전달됩니다. 결과물 검사는 브라우저에서 수행합니다.

공개 API는 요청 크기·동시 요청·IP별 시간당 20회·Worker 인스턴스당 1,000회 제한을 적용합니다. 메모리 제한은 분산/재시작 환경에서 전역 비용 상한이 아닙니다. 운영 전 지속형 할당량과 계정별 과금 제한이 필요합니다.

## 해커톤 범위

웹 Notion·Google OAuth 실연결, 로그인, 기기 동기화, 탭이 닫힌 뒤 서버 푸시, APK/IPA는 미구현입니다. 연결 버튼은 준비 중임을 안내하며 연결 성공으로 표시하지 않습니다. Windows v0.1.0은 초기 프로토타입이며 이번 제출 제품은 v0.2 웹앱입니다.

## 개발

Node 24 기준. 개발자만 .env.example을 참고하여 로컬 .env를 설정합니다. 방문자는 키를 넣지 않습니다.

1. npm ci
2. npm run dev
3. 별도 터미널: npm run dev:api
4. npm test / npm run build / npm run check:openai

src는 UI, shared/core.mjs는 일정/검증 계약, worker/index.mjs는 서버 API, public/pitch와 public/video는 제출 자료입니다. desktop은 이전 설치형 코드를 보존합니다. GitHub Actions가 main을 Pages로 배포하며 API 변경은 Sites에 별도 배포합니다.

자동 테스트 24개와 실제 OpenAI 추천·질문, 누락→수정→완료 UI 흐름을 확인했습니다. docs/VALIDATION.md에 한계를 함께 기록했습니다.
