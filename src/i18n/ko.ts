// D-09: 사용자 노출 문자열은 이 파일에만 둔다.
import type { ParseErrorCode } from '../data/errors.ts';

/** 파일 읽기 단계의 에러 코드 — 파서 코드(ParseErrorCode) + 워커 계층 */
export type LoadErrorCode = ParseErrorCode | 'FILE_TOO_LARGE' | 'WORKER_FAILED' | 'NO_DATA_IN_PERIOD';

export const ko = {
  appTitle: '타임라인 메이커',
  placeholder: '준비 중입니다 — Phase 1 스캐폴딩',
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
