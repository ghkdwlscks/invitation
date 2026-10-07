#!/bin/sh
# 작업 하나를 커밋 하나로 남기고 올린다. 문제가 생기면 그 커밋만 지워 되돌릴 수 있다.
# 사용: sh scripts/deploy.sh "무엇을 바꿨는지"
# 올라가면 GitHub Actions가 빌드해서 GitHub Pages에 배포한다.
set -e
cd "$(dirname "$0")/.."
if [ -z "$1" ]; then
  echo '무엇을 바꿨는지 한 줄로 적어 주세요. 예: sh scripts/deploy.sh "게임 안내문 글씨 키우기"'
  exit 1
fi
git add -A
git commit --quiet -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
