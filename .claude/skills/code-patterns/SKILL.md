# Code Pattern Analysis Skill

## 목적
프로젝트에서 사용되는 코딩 패턴, 아키텍처 패턴, 안티패턴을 식별합니다.

## 아키텍처 패턴 식별

### Layered Architecture
```
특징: Controller/Service/Repository 계층 분리
탐지: controllers/, services/, repositories/ 또는 유사 디렉토리 존재
```

### MVC / MVP / MVVM
```
MVC: Models/, Views/, Controllers/ 구조
MVP: Presenters/ 존재, View-Presenter 분리
MVVM: ViewModels/ 존재, 데이터 바인딩 사용
```

### Clean Architecture / Hexagonal
```
특징: Domain, Application, Infrastructure, Presentation 분리
탐지: domain/, application/, infrastructure/ 또는 ports/, adapters/
```

### Microservices
```
특징: 독립 서비스 단위 디렉토리, 서비스별 빌드 설정
탐지: services/*/, 각 서비스에 독립 package.json/pom.xml
```

### Monorepo
```
특징: packages/ 또는 apps/ 하위에 복수 프로젝트
탐지: lerna.json, turbo.json, nx.json, pnpm-workspace.yaml
```

## 코드 스멜 탐지

### 구조적 스멜
- **God Class**: 하나의 클래스/파일이 500줄 이상, 10개 이상 메서드
- **Feature Envy**: 다른 클래스의 데이터를 과도하게 참조
- **Shotgun Surgery**: 하나의 변경이 여러 파일에 분산
- **Long Parameter List**: 파라미터 5개 이상

### 로직 스멜
- **Deep Nesting**: 3단계 이상 중첩 조건문
- **Long Method**: 50줄 이상 함수
- **Duplicated Logic**: 유사 로직 반복
- **Magic Numbers**: 의미 없는 리터럴 값 사용

### 의존성 스멜
- **Circular Dependency**: 순환 참조
- **Tight Coupling**: 구현에 직접 의존 (인터페이스 미사용)
- **Unused Dependencies**: package에 선언되었으나 미사용

## 디자인 패턴 식별

### 자주 발견되는 패턴
| 패턴 | 탐지 신호 |
|------|-----------|
| Singleton | `getInstance()`, static instance |
| Factory | `create*()`, `*Factory` 클래스 |
| Observer | `addEventListener`, `subscribe`, `on()` |
| Strategy | 인터페이스 + 복수 구현체, 런타임 교체 |
| Repository | `*Repository` 클래스, CRUD 추상화 |
| Builder | 메서드 체이닝, `.build()` 호출 |
| Decorator | 래핑 패턴, 기능 확장 |
| Middleware | 체인 형태 처리, `next()` 호출 |

## 사용법
분석 대상 코드를 읽은 후 위 패턴 매트릭스와 대조하여
발견된 패턴과 안티패턴을 리포트합니다.
