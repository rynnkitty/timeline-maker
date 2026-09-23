// D-09: 사용자 노출 문자열은 이 파일에만 둔다.
import type { ParseErrorCode } from '../data/errors.ts';

/** 파일 읽기 단계의 에러 코드 — 파서 코드(ParseErrorCode) + 워커 계층 */
export type LoadErrorCode = ParseErrorCode | 'FILE_TOO_LARGE' | 'WORKER_FAILED' | 'NO_DATA_IN_PERIOD';

export const ko = {
  appTitle: '타임라인 메이커',
  placeholder: '준비 중입니다 — Phase 1 스캐폴딩',
  /** Phase 3 최소 화면 (Phase 5 에서 디자인) */
  app: {
    pickFile: '타임라인 파일(Timeline.json) 선택',
    name: '이름',
    defaultName: '나',
    loading: '파일을 읽는 중…',
    preparing: '지도를 준비하는 중…',
    privacy:
      '파일은 업로드되지 않고 이 브라우저 안에서만 처리됩니다. 다만 지도 타일을 불러올 때 화면에 보이는 지역 정보가 타일 제공자에게 전달됩니다.',
  },
  preview: {
    play: '재생',
    pause: '일시정지',
    scrub: '재생 위치',
  },
  export: {
    length: '길이',
    lengthOption: (s: number) => `${s}초`,
    resolution: '해상도',
    start: 'MP4 만들기',
    cancel: '취소',
    progress: (frame: number, frames: number, etaS: number) => `영상 만드는 중… ${frame} / ${frames} 프레임 · 약 ${etaS}초 남음`,
    done: (mb: string, s: string) => `완료 — ${mb} MB, ${s}초 걸렸습니다. 다운로드를 시작합니다.`,
    canceled: '영상 만들기를 취소했습니다.',
    errors: {
      INSECURE_CONTEXT: '보안 연결(HTTPS)에서만 영상을 만들 수 있습니다.',
      NO_WEBCODECS: '이 브라우저는 영상 만들기를 지원하지 않습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요.',
      NO_H264: '이 브라우저에서는 이 해상도의 MP4(H.264)를 만들 수 없습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요.',
      NO_WEBGL: '이 브라우저는 지도 그리기(WebGL2)를 지원하지 않습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요.',
      MAP_TIMEOUT: '지도 타일을 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
      ENCODE_FAILED: '영상 인코딩 중 문제가 생겼습니다. 해상도를 낮춰 다시 시도해 주세요.',
    },
  },
  errors: {
    EMPTY_FILE: '빈 파일입니다. 내보낸 타임라인 파일(Timeline.json)을 다시 선택해 주세요.',
    NOT_JSON: 'JSON 파일이 아니거나 파일이 손상되었습니다. 내보낸 타임라인 파일(Timeline.json)을 선택해 주세요.',
    LEGACY_TAKEOUT:
      '예전 Google 테이크아웃 형식(Records.json · Semantic Location History)은 지원하지 않습니다. 휴대폰의 Google 지도 앱에서 내보낸 타임라인 파일(Timeline.json)을 올려 주세요.',
    UNKNOWN_FORMAT: '타임라인 파일 형식을 알아볼 수 없습니다. 휴대폰의 Google 지도 앱에서 내보낸 Timeline.json 인지 확인해 주세요.',
    NO_DATA: '이 파일에는 이동 경로 기록이 없습니다.',
    FILE_TOO_LARGE: '파일이 너무 커서 브라우저에서 읽을 수 없습니다. 약 500MB 까지 지원합니다.',
    NO_DATA_IN_PERIOD: '선택한 기간에는 이동 경로 기록이 없습니다. 기간을 넓혀 보세요.',
    WORKER_FAILED: '파일을 읽는 중 문제가 생겼습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요.',
  } satisfies Record<LoadErrorCode, string>,
} as const;
