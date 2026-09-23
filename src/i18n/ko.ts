// D-09: 사용자 노출 문자열은 이 파일에만 둔다.
import type { ParseErrorCode } from '../data/errors.ts';

/** 파일 읽기 단계의 에러 코드 — 파서 코드(ParseErrorCode) + 워커 계층 */
export type LoadErrorCode = ParseErrorCode | 'FILE_TOO_LARGE' | 'WORKER_FAILED' | 'NO_DATA_IN_PERIOD';

const n = (v: number) => String(Math.trunc(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const ko = {
  appTitle: '타임라인 메이커',
  meta: {
    description:
      '구글 지도 타임라인 파일로 한 해의 이동을 세로 영상(MP4)으로 만듭니다. 파일은 업로드되지 않고 브라우저 안에서만 처리됩니다.',
  },
  intro: '구글 지도 타임라인에서 내보낸 파일로 한 해 동안 움직인 길을 세로 영상으로 만듭니다.',
  step: { file: '파일', options: '영상 설정', make: '만들기' },
  file: {
    choose: 'Timeline.json 선택',
    change: '다른 파일 선택',
    drop: 'Timeline.json 을 여기에 끌어 놓거나',
    dropButton: '파일 선택',
    dropActive: '놓으면 읽기 시작합니다',
    howTo: "휴대폰 Google 지도 앱의 타임라인 설정에서 '타임라인 데이터 내보내기'를 하면 Timeline.json 을 받을 수 있습니다.",
    loading: '파일을 읽는 중입니다…',
    preparing: '지도를 준비하는 중입니다…',
    summary: (points: number, from: string, to: string) => `${from}부터 ${to}까지 ${n(points)}개 지점을 읽었습니다.`,
    iosBeta: 'iPhone 에서 내보낸 파일은 베타로 지원합니다. 결과가 이상하면 Android 에서 내보낸 파일로 다시 시도해 보세요.',
    bigWarn: (mb: number) => `${n(mb)} MB 파일입니다. 읽는 데 시간이 걸리고 메모리를 많이 씁니다.`,
    bigContinue: '계속 읽기',
    bigCancel: '그만두기',
  },
  /** H-5: 실제 동작과 정확히 일치해야 한다 */
  privacy: [
    '파일은 업로드되지 않습니다. 읽기와 영상 만들기 모두 이 브라우저 안에서 처리됩니다.',
    '다만 지도 타일을 불러올 때 화면에 보이는 지역 정보가 타일 제공자(CARTO)에게 전달됩니다.',
  ],
  options: {
    name: '이름',
    namePlaceholder: '예: 나',
    nameHint: (max: number) => `제목에 들어갑니다. 최대 ${max}자.`,
    defaultName: '나',
    period: '기간',
    periodFrom: '시작일',
    periodTo: '종료일',
    theme: '색',
    length: '길이',
    lengthOption: (s: number) => `${s}초`,
    lengthHint: (total: number) => `끝에 전체 경로를 보여주는 ${total}초가 더해집니다.`,
    resolution: '해상도',
  },
  preview: {
    play: '재생',
    pause: '일시정지',
    scrub: '재생 위치',
    empty: '파일을 고르면 여기에서 미리 볼 수 있습니다.',
  },
  errors: {
    EMPTY_FILE: '빈 파일입니다. 내보낸 Timeline.json 을 다시 선택해 주세요.',
    NOT_JSON: 'JSON 파일이 아니거나 파일이 손상되었습니다. 내보낸 Timeline.json 을 선택해 주세요.',
    LEGACY_TAKEOUT:
      '예전 Google 테이크아웃 형식(Records.json · Semantic Location History)은 지원하지 않습니다. 휴대폰의 Google 지도 앱에서 내보낸 Timeline.json 을 올려 주세요.',
    UNKNOWN_FORMAT: '타임라인 파일 형식을 알아볼 수 없습니다. 휴대폰의 Google 지도 앱에서 내보낸 Timeline.json 인지 확인해 주세요.',
    NO_DATA: '이 파일에는 이동 경로 기록이 없습니다.',
    FILE_TOO_LARGE: '파일이 너무 커서 브라우저에서 읽을 수 없습니다. 약 500 MB 까지 지원합니다.',
    NO_DATA_IN_PERIOD: '선택한 기간에는 이동 경로 기록이 없습니다. 기간을 넓혀 보세요.',
    WORKER_FAILED: '파일을 읽는 중 문제가 생겼습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요.',
  } satisfies Record<LoadErrorCode, string>,
  export: {
    start: 'MP4 만들기',
    cancel: '취소',
    estimate: (s: number) => `약 ${s}초 걸립니다. 만드는 동안 이 탭을 화면에 띄워 두세요.`,
    progress: (frame: number, frames: number, etaS: number) => `${n(frame)} / ${n(frames)} 프레임, 약 ${etaS}초 남았습니다.`,
    done: (mb: string, s: string) => `다 만들었습니다. ${mb} MB, ${s}초 걸렸습니다.`,
    download: '다시 받기',
    canceled: '영상 만들기를 취소했습니다.',
    hidden: '이 탭이 화면에 보이는 동안만 영상이 만들어집니다. 탭으로 돌아오면 이어서 진행합니다.',
    errors: {
      INSECURE_CONTEXT: '보안 연결(HTTPS)에서만 영상을 만들 수 있습니다.',
      NO_WEBCODECS: '이 브라우저는 영상 만들기를 지원하지 않습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요.',
      NO_H264: '이 브라우저에서는 이 해상도의 MP4(H.264)를 만들 수 없습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요.',
      NO_WEBGL: '이 브라우저는 지도 그리기(WebGL2)를 지원하지 않습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요.',
      MAP_TIMEOUT: '지도 타일을 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
      ENCODE_FAILED: '영상 인코딩 중 문제가 생겼습니다. 해상도를 낮춰 다시 시도해 주세요.',
    },
  },
  footer: {
    attribution: '지도 © OpenStreetMap contributors © CARTO',
    note: '이 사이트는 분석 도구·쿠키를 쓰지 않습니다.',
  },
} as const;
