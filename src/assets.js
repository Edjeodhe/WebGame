// 원화(일러스트) 이미지 로더.
//
// 게임 본체는 이미지 파일 없이 픽셀 블록으로 그려지지만, 시작화면과 좌측 상단
// 초상화에는 "그려진 원화"를 그대로 쓰고 싶을 때가 있다. 여기서 원화 PNG를
// 미리 불러오고, 파일이 아직 없으면 ready=false를 유지해 호출부가 기존 픽셀
// 스프라이트로 자연스럽게 폴백하도록 한다. 즉, 아래 경로에 파일을 넣기 전에도
// 게임은 정상 동작하고, 파일을 넣고 배포하면 자동으로 원화가 나타난다.
//
// 넣어야 할 파일(저장소 루트 기준):
//   assets/portraits/ant.png        — 개미 전사 초상화(세로형 권장)
//   assets/portraits/beetle.png     — 장수풍뎅이 궁수 초상화
//   assets/portraits/butterfly.png  — 나비 마법사 초상화
//   assets/portraits/dragonfly.png  — 잠자리 도적 초상화
//   assets/title.png (선택)         — 시작화면 전체에 깔 원화(예: 4종 한 장짜리
//                                     콘셉트 이미지). 있으면 시작화면 배경으로 쓴다.

function load(path) {
  const rec = { img: new Image(), ready: false, failed: false, path };
  rec.img.onload = () => { rec.ready = rec.img.naturalWidth > 0; };
  rec.img.onerror = () => { rec.failed = true; };
  rec.img.src = path; // index.html(문서) 기준 상대경로 → 사이트 루트의 assets/
  return rec;
}

export const PORTRAITS = {
  ant: load('assets/portraits/ant.png'),
  beetle: load('assets/portraits/beetle.png'),
  butterfly: load('assets/portraits/butterfly.png'),
  dragonfly: load('assets/portraits/dragonfly.png'),
};

export const TITLE_ART = load('assets/title.png');

export function imgReady(rec) {
  return !!(rec && rec.ready && rec.img.naturalWidth > 0);
}

// 이미지를 대상 사각형에 "cover"(비율 유지 + 꽉 채우기, 넘치는 부분은 잘림)로 그린다.
export function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = dw / dh;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (ir > dr) { // 이미지가 더 넓다 → 좌우를 자른다
    sw = img.naturalHeight * dr;
    sx = (img.naturalWidth - sw) / 2;
  } else { // 이미지가 더 높다 → 위아래를 자른다
    sh = img.naturalWidth / dr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// 이미지를 대상 사각형에 "contain"(비율 유지 + 안에 다 들어오게, 여백 생김)으로 그린다.
export function drawImageContain(ctx, img, dx, dy, dw, dh) {
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = dw / dh;
  let w = dw, h = dh;
  if (ir > dr) { h = dw / ir; } else { w = dh * ir; }
  ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
}
