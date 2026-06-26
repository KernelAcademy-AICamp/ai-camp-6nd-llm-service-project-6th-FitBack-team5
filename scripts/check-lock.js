// EAS Build (Node 22 환경) 와 호환되는 lock 인지 검증.
// Node 24 에서 npm install 시 @expo/config/node_modules/typescript nested 엔트리가
// prune 되어 EAS 의 npm ci 가 실패. 빌드 시작 전에 막는다.

const fs = require('fs');
const path = require('path');

const NESTED_TS_KEY = 'node_modules/@expo/config/node_modules/typescript';
const NODE_REQUIRED_MAJOR = 22;

const errors = [];

const lockPath = path.join(__dirname, '..', 'package-lock.json');
if (!fs.existsSync(lockPath)) {
  errors.push('package-lock.json 이 없습니다.');
} else {
  const lock = fs.readFileSync(lockPath, 'utf8');
  if (!lock.includes(NESTED_TS_KEY)) {
    errors.push(
      `package-lock.json 에 "${NESTED_TS_KEY}" 엔트리가 없습니다.\n` +
        `   원인: 누군가 Node ${NODE_REQUIRED_MAJOR} 가 아닌 버전으로 npm install 을 돌려 lock 이 재생성됨.\n` +
        `   해결: nvm use ${NODE_REQUIRED_MAJOR} && rm package-lock.json && npm install 후 커밋.`,
    );
  }
}

const currentMajor = Number(process.versions.node.split('.')[0]);
if (currentMajor !== NODE_REQUIRED_MAJOR) {
  errors.push(
    `현재 Node 버전이 ${process.versions.node} 입니다. EAS Build 호환을 위해 Node ${NODE_REQUIRED_MAJOR} 필요.\n` +
      `   해결: nvm use ${NODE_REQUIRED_MAJOR}`,
  );
}

if (errors.length > 0) {
  console.error('\n❌ Preflight 검증 실패:\n');
  errors.forEach((e, i) => console.error(`${i + 1}. ${e}\n`));
  process.exit(1);
}

console.log(`✓ Preflight OK (Node ${process.versions.node}, lock 정합)`);
