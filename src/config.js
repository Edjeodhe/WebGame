// Cloudflare Worker(API) 주소.
// worker/ 를 처음 배포하면 Cloudflare가 `insect-king-api.<계정 서브도메인>.workers.dev` 형태의
// 주소를 발급한다. GitHub Actions 배포 로그(Deploy Cloudflare Worker) 또는
// Cloudflare 대시보드 > Workers & Pages 에서 확인해 아래 값을 실제 주소로 교체하라.
export const API_BASE = 'https://insect-king-api.minsung042119.workers.dev';
