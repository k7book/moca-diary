# 모카 일지 — 설치 안내

크레스티드 게코 모카를 돌보는 가족 공유 모바일 웹앱. 빌드 도구 없이 정적 파일만으로 동작합니다.

## 폴더 구조

```
moca-diary/
├─ index.html            # 앱 본체
├─ css/app.css
├─ js/config.js          # ★ Supabase 설정 (여기만 고치면 됨)
├─ js/data.js            # 데이터 계층 (Supabase / 데모 모드)
├─ js/app.js             # 화면·로직
├─ manifest.webmanifest  # PWA
├─ sw.js                 # 오프라인 열람용 서비스 워커
├─ icons/                # 앱 아이콘
└─ supabase/schema.sql   # DB 스키마·RLS·RPC
```

## 1단계 — 바로 써보기 (데모 모드, 5분)

`js/config.js`를 비워 둔 채로 `index.html`을 열면 **데모 모드**로 동작합니다. 이 폰에만 저장되고 가족과 공유되지 않지만, 모든 화면을 미리 써 볼 수 있습니다.

## 2단계 — Supabase 연결 (가족 공유, 20분)

1. https://supabase.com 에서 무료 프로젝트 생성 (리전: Northeast Asia / Seoul 권장)
2. **Authentication → Providers → Anonymous sign-ins** 를 켭니다. (이메일 없이 초대 코드만으로 들어오기 위해 필요)
3. **SQL Editor** 에 `supabase/schema.sql` 전체를 붙여넣고 Run
4. **Storage → New bucket** 이름 `photos`, **Public 체크 해제**(비공개)
5. **Project Settings → API** 에서 `Project URL`과 `anon public` 키를 복사해 `js/config.js`에 넣습니다.

```js
window.MOCA_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  REMINDER_HOUR: 20,
};
```

## 3단계 — Cloudflare Pages 배포 (10분)

1. 이 폴더를 GitHub 저장소에 push (예: `moca-diary`)
2. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
3. 저장소 선택, Framework preset: **None**, Build command: 비움, Build output directory: `/`
4. 배포 완료 후 주소 예: `https://moca-diary.pages.dev`

이후 GitHub에 push할 때마다 자동 배포됩니다.

## 4단계 — 가족 합류

1. 아빠(관리자)가 앱을 열고 **가족 만들기** → 초대 코드 6자리가 생깁니다 (가족 탭에서 다시 볼 수 있음)
2. 라진·율하·엄마는 각자 폰에서 앱을 열고 **초대 코드 + 이름**으로 들어갑니다. 라진은 "내가 모카를 돌봐요"를 선택
3. 홈 화면에 추가
   - Android Chrome: 메뉴(⋮) → **홈 화면에 추가**
   - iPhone Safari: 공유 버튼 → **홈 화면에 추가**

## 역할

| 역할 | 할 수 있는 것 |
| --- | --- |
| 주 보호자 (라진) | 기록 작성·수정, 체크리스트, 사진 |
| 관찰자 (율하·엄마) | 열람, 기록 보조 작성 (작성자 표시됨) |
| 관리자 (아빠) | 위 전부 + 구성원 역할 변경·삭제, 밥 간격·나이 설정, 내보내기 |

스트리크(연속 기록)는 **주 보호자가 직접 쓴 날**만 셉니다.

## 자주 묻는 것

- **사진 용량**: 업로드 시 1280px로 줄여 저장합니다. 무료 1GB 기준 약 5,000장.
- **온습도 숫자 입력**: 홈의 "준비 중인 것"에서 **온습도계**를 체크하면 기록 화면에 숫자 칸이 열립니다.
- **용어**: 상단 "가" 버튼 또는 가족 탭 설정에서 쉬운 말(정식 용어) ↔ 정식 용어 전환.
- **밥 주는 날**: 입양일을 0일로 두고 간격(기본 2일)마다 돌아옵니다. 가족 탭에서 관리자가 변경.

## MVP 범위 밖 (다음 단계)

가족 응원 스티커·댓글, 쉬는 날 쿠폰, 푸시 알림, CSV 내보내기, 여러 마리 관리. 스키마에는 `reactions` 테이블이 이미 들어 있어 v1.1에서 바로 붙일 수 있습니다.
