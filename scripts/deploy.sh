#!/bin/sh
# 저장소에는 커밋을 하나만 남긴다. 지금 상태로 그 커밋을 덮어쓰고 강제로 올린다.
# 올라가면 GitHub Actions가 빌드해서 GitHub Pages에 배포한다.
set -e
cd "$(dirname "$0")/.."
MESSAGE='황진찬 ♥ 김가현 모바일 청첩장

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
git add -A
if git rev-parse --verify -q HEAD >/dev/null; then
  git commit --amend --reset-author --quiet -m "$MESSAGE"
else
  git commit --quiet -m "$MESSAGE"
fi
git push --force origin main
