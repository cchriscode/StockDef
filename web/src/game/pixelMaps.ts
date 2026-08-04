// 픽셀 지도 데이터 — Dead Cat Bounce Flow 목업의 8px 셀 런렝스 지도를 이식
// 형식: 행별 "키+시작-끝" 토큰 (예: "n26-39" = 북미 셀 26~39). 빈 문자열 = 빈 행.

export interface MapSeg {
  x: number;
  y: number;
  w: number;
  h: number;
  k: string;
}

export interface Country {
  key: string;
  name: string;
  en: string;
  color: string;
  status: 'open' | 'next' | 'locked';
  stages: number;
  desc: string;
}

// 국가 메타 (목업 순서 유지 — MVP는 한국만 open)
export const COUNTRIES: Country[] = [
  { key: 'k', name: '한국', en: 'KOREA', color: '#46A574', status: 'open', stages: 3, desc: '홈 그라운드. 개인 투자자의 전장.' },
  { key: 'j', name: '일본', en: 'JAPAN', color: '#B85C7A', status: 'next', stages: 6, desc: '저금리 장기전. 엔 캐리의 나라.' },
  { key: 'c', name: '중국', en: 'CHINA', color: '#B04A55', status: 'locked', stages: 11, desc: '국영 자본. 정책 한 줄에 시장이 뒤집힌다.' },
  { key: 'i', name: '인도', en: 'INDIA', color: '#3E8C8C', status: 'locked', stages: 9, desc: '신흥 성장. 젊고 거칠다.' },
  { key: 'e', name: '유럽', en: 'EUROPE', color: '#7A6BC4', status: 'locked', stages: 14, desc: '규제와 국채. 느리지만 무거운 전선.' },
  { key: 'n', name: '북미', en: 'NORTH AMERICA', color: '#4E7FB8', status: 'locked', stages: 12, desc: '월가. 초 단위 알고리즘 전쟁.' },
  { key: 's', name: '남미', en: 'SOUTH AMERICA', color: '#A8862B', status: 'locked', stages: 8, desc: '원자재와 인플레이션의 땅.' },
  { key: 'f', name: '아프리카', en: 'AFRICA', color: '#C97A3E', status: 'locked', stages: 6, desc: '자원 사이클. 변동성 최대.' },
  { key: 'r', name: '러시아·CIS', en: 'CIS', color: '#5E6E86', status: 'locked', stages: 7, desc: '에너지 카르텔. 제재의 안개.' },
  { key: 'a', name: '오세아니아', en: 'OCEANIA', color: '#8A9E3E', status: 'locked', stages: 5, desc: '광산과 배당. 조용한 후방.' },
];

// 세계지도 (등장방형, 144×57 셀)
const WORLD_RAW = ['', '', 'n54-60', 'n52-62,r110-113', 'n26-39,n50-63,r103-128', 'n9-13,n22-38,n50-62,e81-82,r96-134', 'n7-37,n51-61,e78-83,r91-142', 'n5-36,n52-58,e63-66,e77-83,r86-142', 'n5-34,n53-56,e75-82,r84-139', 'n6-33,e75-81,r84-135', 'n8-9,n17-46,e70-70,e74-77,e82-84,r85-128', 'n19-48,e70-70,e80-84,r85-127', 'n20-49,e68-69,e77-86,r87-127', 'n21-48,e69-69,e72-74,e76-87,r88-109,r115-126', 'n22-47,e70-87,r88-104,c108-120,r122-126', 'n22-45,e71-83,e86-86,r88-103,c104-121,r124-125,j129-129', 'n22-43,e68-72,e78-82,r93-102,c103-120,j128-129', 'n22-42,e68-71,e78-81,r96-100,c101-120,j127-128', 'n23-42,e68-71,e77-77,c102-119,k122-123,j127-127', 'n24-41,f68-76,c102-119,k122-123,j125-126', 'n25-39,f68-78,c104-119', 'n27-39,f67-84,i101-104,c105-119', 'n27-32,n39-39,f67-85,i100-105,c107-119', 'n28-33,f66-86,i99-107,c108-118', 'n29-34,f66-86,i100-108,c109-116', 'n30-36,f65-87,i101-105,c110-115', 'n32-37,f65-87,i101-104,c111-113', 'n35-35,n37-38,f65-88,i102-103,c111-114,a121-121', 'n38-38,f66-88,i102-103,c111-114,a121-121', 'n39-39,s42-46,f66-91,i102-102,c113-114,a120-121', 's42-48,f67-91,a120-121', 's41-50,f68-90', 's41-51,f75-89,a111-111,a117-118', 's40-51,f75-88,a112-112,a116-119', 's40-54,f76-88,a116-118', 's40-56,f76-87,a113-113,a126-129', 's40-57,f76-87,a115-117,a127-130', 's41-57,f76-87', 's41-56,f76-87,a123-128', 's42-55,f77-86,f89-90,a122-129', 's43-55,f77-86,f89-91,a121-129', 's44-54,f77-85,f89-91,a119-130', 's44-53,f77-85,f90-91,a117-131', 's44-52,f78-85,f90-91,a117-132', 's44-51,f78-84,a118-132', 's44-51,f79-83,a118-132', 's43-50,f79-82,a119-122,a124-131', 's42-49,a126-131', 's42-48,a128-130,a142-142', 's42-46,a141-141', 's43-46,a140-140', 's43-45,a139-139', 's43-44', 's43-44', 's43-43', '', ''];

// 한반도 (41×74 셀)
const KR_RAW = ['', '', '', '', '', 'm33-34', 'm31-35', 'm29-35', 'm28-34', 'm27-33', 'm25-32', 'm24-31', 'm23-30', 'm15-20,m22-30', 'm14-30', 'm13-29', 'm13-29', 'm12-29', 'm11-30', 'm10-30', 'm9-29', 'm8-29', 'm6-28', 'm4-28', 'm2-27', 'm2-26', 'm3-25', 'm4-24', 'm4-22', 'm5-18', 'm5-18', 'm6-18', 'm6-18', 'm7-21', 'm6-23', 'm6-23', 'm5-24', 'm5-24', 'm5-25', 'm6-7,m13-25', 'm13-26', 'm12-26,m37-37', 'm11-27', 'm11-27', 'm12-27', 'm13-28', 'm12-28', 'm12-28', 'm12-29', 'm13-29', 'm13-29', 'm13-29', 'm12-29', 'm12-29', 'm12-29', 'm12-29', 'm13-28', 'm13-28', 'm13-28', 'm12-23', 'm12-20', 'm12-20', 'm12-19', 'm13-13,m16-17', '', '', '', '', '', 'm13-15', 'm11-15', 'm11-15', '', ''];

export function expandMap(raw: string[], cell: number): MapSeg[] {
  const segs: MapSeg[] = [];
  raw.forEach((line, y) => {
    if (!line) return;
    for (const tok of line.split(',')) {
      const k = tok[0];
      const a = parseInt(tok.slice(1), 10);
      const b = parseInt(tok.slice(tok.indexOf('-') + 1), 10);
      segs.push({ x: a * cell, y: y * cell, w: (b - a + 1) * cell, h: cell, k });
    }
  });
  return segs;
}

export const worldSegs = (cell: number) => expandMap(WORLD_RAW, cell);
export const krSegs = (cell: number) => expandMap(KR_RAW, cell);
export const WORLD_COLS = 144;
export const WORLD_ROWS = 57;
export const KR_COLS = 41;
export const KR_ROWS = 74;
