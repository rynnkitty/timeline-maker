# Project Detection Skill

## 목적
프로젝트 루트 디렉토리를 스캔하여 기술 스택, 빌드 도구, 프레임워크를 자동으로 식별합니다.

## 감지 매트릭스

### 언어 감지
| 파일/패턴 | 언어 |
|-----------|------|
| `*.cs`, `*.csproj`, `*.sln` | C# |
| `*.java`, `pom.xml`, `build.gradle` | Java |
| `*.py`, `requirements.txt`, `pyproject.toml` | Python |
| `*.ts`, `tsconfig.json` | TypeScript |
| `*.js`, `package.json` | JavaScript |
| `*.go`, `go.mod` | Go |
| `*.rs`, `Cargo.toml` | Rust |
| `*.rb`, `Gemfile` | Ruby |
| `*.php`, `composer.json` | PHP |
| `*.kt`, `*.kts` | Kotlin |
| `*.swift`, `Package.swift` | Swift |
| `*.dart`, `pubspec.yaml` | Dart |

### 프레임워크 감지
| 파일/키워드 | 프레임워크 |
|-------------|-----------|
| `next.config.*` | Next.js |
| `nuxt.config.*` | Nuxt.js |
| `angular.json` | Angular |
| `vite.config.*` | Vite |
| `django`, `manage.py` | Django |
| `flask` | Flask |
| `fastapi` | FastAPI |
| `spring` in pom.xml | Spring Boot |
| `rails` | Ruby on Rails |
| `laravel` | Laravel |
| `.csproj` → `Microsoft.NET.Sdk.Web` | ASP.NET |
| `express` in package.json | Express.js |

### 빌드/배포 감지
| 파일 | 도구 |
|------|------|
| `Dockerfile`, `docker-compose.yml` | Docker |
| `.github/workflows/` | GitHub Actions |
| `Jenkinsfile` | Jenkins |
| `.gitlab-ci.yml` | GitLab CI |
| `terraform/`, `*.tf` | Terraform |
| `k8s/`, `kubernetes/` | Kubernetes |

### DB/ORM 감지
| 키워드/파일 | 기술 |
|-------------|------|
| `prisma/schema.prisma` | Prisma |
| `sequelize` | Sequelize |
| `typeorm` | TypeORM |
| `entity-framework`, `DbContext` | Entity Framework |
| `dapper` | Dapper |
| `sqlalchemy` | SQLAlchemy |
| `mongoose` | Mongoose (MongoDB) |

## 사용법
프로젝트 루트에서 다음 파일들을 우선 확인:
1. 빌드 설정 파일 (package.json, pom.xml, *.csproj 등)
2. 설정 파일 (tsconfig.json, .env, app.config 등)
3. 루트 디렉토리 구조
4. .gitignore (사용 기술의 힌트 제공)

## 출력
감지 결과를 `CLAUDE.md`의 프로젝트 정보 섹션에 자동 반영합니다.
