import { H } from './helpers.js';
// 19 rigged units. Each entry:
//   kr/en      display names
//   file       source pose SVG (assets/)
//   vb         SVG viewBox the markup is authored in
//   parts      animatable part ids, in paint order (z-order)
//   markup     inner SVG; every part is a <g id="..."> — wrapped in <g id="root"> by the player
//   notes      per-motion rigging spec (Korean)
//   anim       (phase 0..1, motion, A) => void   A = { set, attr, opacity, filter }
export function buildRigs(){
  const L=H.lerp.bind(H), S=H.seg.bind(H), TR=H.track.bind(H);

    if(H._rg19) return H._rg19;

    const sin=Math.sin, PI2=Math.PI*2;

    // ============ 1. BOND GUARDIAN ============
    const guardian = {
      kr:"채권 수호병", en:"Bond Guardian", file:"assets/01-bond-guardian.svg", vb:"0 0 170 205",
      parts:["shadow","plume","legBack","torso","armBack","sword","legFront","head","armFront","shield"],
      markup:`
<g id="shadow"><ellipse cx="78" cy="190" rx="40" ry="5.5" fill="#000" opacity=".6"/></g>
<g id="plume"><path d="M84 34 C 68 12, 42 12, 34 26 C 50 22, 68 30, 78 46 Z" fill="url(#gRed)"/></g>
<g id="legBack">
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="url(#gSteelD)"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="url(#gSteelD)"/>
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="#000" opacity=".34"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="#000" opacity=".34"/>
</g>
<g id="torso">
  <path d="M58 118 L106 116 L108 146 L56 148 Z" fill="url(#pMail)"/>
  <path d="M58 116 C64 108, 94 106, 102 116 L106 142 C104 154, 92 160, 79 160 C65 160, 57 152, 55 142 Z" fill="url(#gSteel)"/>
  <path d="M98 114 C104 124, 106 138, 102 152 C99 158, 92 160, 86 160 C96 154, 100 140, 97 126 Z" fill="#DCE5F2" opacity=".25"/>
  <path d="M60 114 C54 126, 53 144, 58 155 C50 147, 50 126, 60 114 Z" fill="#000" opacity=".33"/>
  <path d="M56 154 L106 152 L108 162 L54 164 Z" fill="url(#gSteelD)"/>
  <path d="M56 154 L106 152 L106.4 154.6 L56.4 156.6 Z" fill="#A3AEC0" opacity=".4"/>
  <rect x="55" y="149" width="50" height="6" rx="2" fill="url(#gLeather)"/>
  <rect x="82" y="147" width="12" height="9" rx="2" fill="url(#gGold)"/>
</g>
<g id="armBack">
  <path d="M48 122 C48 106, 72 100, 82 110 L 78 122 C 70 114, 55 116, 52 128 Z" fill="url(#gSteel)"/>
  <path d="M48 122 C48 106, 72 100, 82 110 L80 113 C70 104, 53 110, 51 124 Z" fill="#E4EBF7" opacity=".38"/>
  <path d="M50 128 C52 114, 74 110, 82 120 L79 130 C 71 122, 57 124, 54 134 Z" fill="url(#gSteelD)"/>
  <g id="sword">
    <path d="M50.5 132 L55.5 132 L57 172 L53 174 Z" fill="url(#gBlade)"/>
    <path d="M53 133 L54.2 172" stroke="#fff" stroke-width=".8" opacity=".45"/>
    <path d="M45 128 L61 128 L61 132.5 L45 132.5 Z" fill="url(#gGold)"/>
    <rect x="50.5" y="119" width="5.5" height="10" rx="2.2" fill="url(#gLeather)"/>
    <circle cx="53.2" cy="118" r="2.6" fill="url(#gGold)"/>
  </g>
</g>
<g id="legFront">
  <path d="M80 156 L78 174 L96 176 L98 156 Z" fill="url(#gSteel)"/>
  <path d="M74 174 L98 176 L110 184 L110 189 L72 187 Z" fill="url(#gSteelD)"/>
</g>
<g id="head">
  <path d="M42 78 C42 48, 60 34, 80 34 C100 34, 114 46, 117 66 C120 80, 117 96, 106 106 C95 116, 70 119, 55 109 C45 102, 42 90, 42 78 Z" fill="url(#gSteel)"/>
  <path d="M48 74 C48 50, 62 38, 80 38 C88 38, 95 40, 100 44 C90 40, 74 42, 63 54 C54 63, 50 72, 50 82 Z" fill="#F0F5FF" opacity=".4"/>
  <path d="M42 78 C42 62, 48 50, 56 42 C48 54, 46 68, 48 82 C50 96, 58 106, 70 111 C56 109, 44 94, 42 78 Z" fill="#000" opacity=".33"/>
  <path d="M62 50 C74 40, 96 42, 108 54 L 105 60 C 94 50, 76 48, 66 56 Z" fill="url(#gSteelD)"/>
  <path d="M80 62 C94 57, 108 60, 117 68 L 116 76 C 106 68, 94 66, 82 71 Z" fill="url(#gSteel)"/>
  <path d="M80 62 C94 57, 108 60, 117 68 L116.4 70.6 C107 62.6, 94 60.6, 81 65.6 Z" fill="#EAF0FB" opacity=".45"/>
  <path d="M81 74 C94 69, 106 71, 116 78 L 115 85 C 105 79, 94 77, 82 82 Z" fill="#05070B"/>
  <path d="M83 81 C94 77, 105 79, 114 84 L114 85.4 C105 80.4, 94 78.6, 83 82.4 Z" fill="#8E9BB0" opacity=".5"/>
  <path d="M83 88 C94 83, 106 86, 113 93 C111 102, 102 110, 91 113 C83 114, 77 112, 74 109 Z" fill="url(#gSteelD)"/>
  <path d="M92 94 L99 92 M94 100 L102 98 M96 105 L103 103" stroke="#05070B" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M55 109 C68 119, 92 117, 105 106 L106 116 C93 128, 68 129, 54 118 Z" fill="url(#gSteelD)"/>
  <path d="M55 109 C68 119, 92 117, 105 106 L104.6 108.5 C92 118.5, 69 120, 56 111 Z" fill="#A3AEC0" opacity=".45"/>
</g>
<g id="armFront">
  <path d="M82 126 L96 124 L106 130 L102 138 L90 134 L82 136 Z" fill="url(#gSteel)"/>
  <g id="shield">
    <path d="M102 118 L134 129 L131 166 L114 183 L102 160 Z" fill="url(#gSteelD)"/>
    <path d="M102 118 L134 129 L131 166 L114 183 L102 160 Z" fill="none" stroke="url(#gGold)" stroke-width="2.6"/>
    <path d="M106 124 L128 132 L126 162 L113 174 L106 154 Z" fill="#6E212A"/>
    <path d="M106 124 L128 132 L127 148 L106 141 Z" fill="#fff" opacity=".09"/>
    <rect x="110" y="150" width="3.4" height="10" fill="url(#gGold)"/>
    <rect x="116" y="144" width="3.4" height="14" fill="url(#gGold)"/>
    <rect x="122" y="139" width="3.4" height="16" fill="url(#gGold)"/>
  </g>
</g>`,
      notes:{
        walk:"낮은 자세 행군. 앞다리(88,152)·뒷다리(68,146) 힙 피벗으로 ±25° 교차, 몸통은 접지마다 2단 바운스. 방패는 앞팔 회전을 역보정해 항상 수평·정면 유지, 크림슨 깃털은 몸통보다 1프레임 늦게 따라옵니다.",
        attack:"방패 밀치기 + 단검 찌르기. 뒷팔이 앞으로 나오며 단검이 그립(53,128)을 축으로 -90° 회전해 검신이 완전히 수평 정면을 향하고, 방패 뒤로 내질러집니다. 앞다리가 버티며 몸통이 체중을 실어 전진.",
        hit:"방패로 받아내는 피격. 몸통·머리가 뒤로 젖혀지고 앞다리가 미끄러지며, 방패만 정면을 유지하려 버팁니다.",
        death:"무릎이 꺾이고 발밑(80,188)을 축으로 뒤로 넘어짐. 방패가 손에서 벌어지고 단검은 아래로 떨어지며 깃털이 늦게 쓸립니다.",
        skill:"원금 보장. 두 다리를 넓게 벌려 고정하고 방패를 정면에 세운 뒤, 상체를 낮춰 버팀 자세로 고정합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph), c=sin(PI2*ph+Math.PI/2);
        if(mo==="walk"){
          const bob=-2.4*Math.abs(s);
          A.set("legBack",{r:[-25*s,68,146]});
          A.set("legFront",{r:[22*s,88,152]});
          A.set("torso",{t:[0,bob],r:[1.4*s,80,150]});
          A.set("head",{t:[0,bob-0.6],r:[-1.2*s,80,110]});
          A.set("plume",{t:[0,bob],r:[-7*sin(PI2*(ph-0.14)),84,42]});
          A.set("armBack",{t:[0,bob],r:[13*s,78,116]});
          A.set("sword",{r:[-6*s,53,128]});
          A.set("armFront",{t:[1.5*s,bob],r:[-2.5*s,86,128]});
          A.set("shield",{r:[2.5*s-1.4*s,104,140]});
          A.set("shadow",{s:[1-0.05*Math.abs(s),1,78,190]});
        } else if(mo==="attack"){
          const wind=S(ph,0,.26), push=S(ph,.26,.44), hold=S(ph,.44,.6), back=S(ph,.6,1);
          const fwd = TR(ph,[[0,0],[.26,-7],[.44,20],[.6,15],[1,0]],"out");
          const trot= TR(ph,[[0,0],[.26,-5],[.44,9],[.6,7],[1,0]],"out");
          A.set("torso",{t:[fwd,0],r:[trot,80,150]});
          A.set("head",{t:[fwd*0.9,0],r:[trot*0.5,80,110]});
          A.set("plume",{t:[fwd*0.8,0],r:[TR(ph,[[0,0],[.3,14],[.5,-16],[.75,6],[1,0]],"out"),84,42]});
          A.set("legBack",{r:[TR(ph,[[0,0],[.26,10],[.44,-16],[.7,-8],[1,0]],"out"),68,150]});
          A.set("legFront",{r:[TR(ph,[[0,0],[.26,-6],[.44,12],[.7,8],[1,0]],"out"),88,157]});
          A.set("armFront",{t:[TR(ph,[[0,0],[.26,-8],[.44,26],[.6,18],[1,0]],"out"),0],r:[TR(ph,[[0,0],[.44,-4],[1,0]],"out"),86,128]});
          A.set("shield",{r:[TR(ph,[[0,0],[.26,6],[.44,-3],[1,0]],"out"),104,140]});
          A.set("armBack",{t:[TR(ph,[[0,0],[.26,-6],[.5,30],[.65,22],[1,0]],"out"),TR(ph,[[0,0],[.5,-8],[.65,-6],[1,0]],"out")],
                           r:[TR(ph,[[0,0],[.26,-14],[.5,42],[.65,36],[1,0]],"out"),78,116]});
          A.set("sword",{r:[TR(ph,[[0,0],[.26,18],[.5,-132],[.65,-126],[1,0]],"out"),53,128],
                         t:[TR(ph,[[0,0],[.5,10],[.65,8],[1,0]],"out"),0]});
          A.set("shadow",{t:[fwd*0.5,0]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("torso",{t:[-9*k,0],r:[-9*k,80,150]});
          A.set("head",{t:[-11*k,0],r:[-13*k,80,110]});
          A.set("plume",{t:[-10*k,0],r:[22*k,84,42]});
          A.set("legBack",{r:[-12*k,68,150]});
          A.set("legFront",{r:[-16*k,88,157],t:[-4*k,0]});
          A.set("armBack",{t:[-8*k,0],r:[-16*k,78,116]});
          A.set("sword",{r:[10*k,53,128]});
          A.set("armFront",{t:[-4*k,0],r:[7*k,86,128]});
          A.set("shield",{r:[-6*k,104,140]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.65*k})`);
        } else if(mo==="death"){
          const kn=S(ph,.05,.3), fall=H.inn(S(ph,.28,.72)), rest=S(ph,.72,.86), fade=S(ph,.86,1);
          A.set("root",{r:[-88*fall,80,188]});
          A.set("legBack",{r:[38*kn-14*fall,68,150]});
          A.set("legFront",{r:[-44*kn+18*fall,88,157]});
          A.set("torso",{t:[0,10*kn],r:[-6*kn,80,150]});
          A.set("head",{t:[0,10*kn],r:[16*kn+18*fall+8*rest,80,110]});
          A.set("plume",{t:[0,10*kn],r:[-26*fall-10*rest,84,42]});
          A.set("armBack",{t:[0,10*kn],r:[-34*fall,78,116]});
          A.set("sword",{r:[52*fall,53,128],t:[0,10*fall]});
          A.set("armFront",{t:[0,10*kn],r:[30*fall+10*rest,86,128]});
          A.set("shield",{r:[44*fall,104,140],t:[6*fall,8*fall]});
          A.set("shadow",{s:[1+0.25*fall,1-0.4*fade,78,190]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.5*fall}) brightness(${1-0.25*fall})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("legBack",{r:[-15*r,68,150]});
          A.set("legFront",{r:[15*r,88,157]});
          A.set("torso",{t:[0,3*r],r:[3*r,80,150]});
          A.set("head",{t:[0,3*r],r:[-2*r,80,110]});
          A.set("plume",{t:[0,3*r],r:[-6*r+2*p,84,42]});
          A.set("armBack",{t:[0,3*r],r:[-8*r,78,116]});
          A.set("armFront",{t:[7*r,2*r],r:[-6*r,86,128]});
          A.set("shield",{r:[6*r+0.8*p,104,140]});
          A.filter(`drop-shadow(0 0 ${6+5*Math.abs(p)}px rgba(244,226,172,${.45+.3*Math.abs(p)}))`);
        }
      }
    };

    // ============ 2. GROWTH BLADE ============
    const blade = {
      kr:"성장주 검사", en:"Growth Blade", file:"assets/02-growth-blade.svg", vb:"-10 -20 190 225",
      parts:["shadow","legBack","torso","armBack","legFront","head","gorget","armFront","greatsword"],
      markup:`
<g id="shadow"><ellipse cx="78" cy="190" rx="40" ry="5.5" fill="#000" opacity=".6"/></g>
<g id="legBack">
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="url(#gSteelD)"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="url(#gSteelD)"/>
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="#000" opacity=".34"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="#000" opacity=".34"/>
</g>
<g id="torso">
  <path d="M58 116 C64 108, 94 106, 102 116 L106 142 C104 154, 92 160, 79 160 C65 160, 57 152, 55 142 Z" fill="url(#gSteel)"/>
  <path d="M98 114 C104 124, 106 138, 102 152 C99 158, 92 160, 86 160 C96 154, 100 140, 97 126 Z" fill="#DCE5F2" opacity=".25"/>
  <path d="M60 114 C54 126, 53 144, 58 155 C50 147, 50 126, 60 114 Z" fill="#000" opacity=".33"/>
  <path d="M74 110 C 78 128, 78 146, 74 158" stroke="#12151d" stroke-width="2" fill="none" opacity=".5"/>
  <path d="M56 154 L106 152 L108 164 L54 166 Z" fill="url(#gRed)"/>
  <rect x="55" y="148" width="50" height="7" rx="2" fill="url(#gLeather)"/>
  <rect x="82" y="146" width="13" height="10" rx="2" fill="url(#gGold)"/>
</g>
<g id="armBack">
  <path d="M48 120 C48 106, 70 100, 80 110 L 76 122 C 68 114, 55 116, 52 126 Z" fill="url(#gSteel)"/>
  <path d="M48 120 C48 106, 70 100, 80 110 L78 113 C68 104, 53 110, 51 122 Z" fill="#E4EBF7" opacity=".38"/>
</g>
<g id="legFront">
  <path d="M80 156 L78 174 L96 176 L98 156 Z" fill="url(#gSteel)"/>
  <path d="M74 174 L98 176 L110 184 L110 189 L72 187 Z" fill="url(#gSteelD)"/>
</g>
<g id="head">
  <path d="M42 78 C42 48, 60 34, 80 34 C100 34, 114 46, 117 66 C119 78, 116 90, 110 96 C104 102, 96 110, 86 114 C70 118, 54 112, 47 100 C43 93, 42 86, 42 78 Z" fill="url(#gSkin)"/>
  <path d="M108 74 C114 72, 118 76, 117 82 C116 88, 111 90, 108 88 Z" fill="url(#gSkin)"/>
  <path d="M100 84 L112 82 L110 88 L101 89 Z" fill="#C08F62" opacity=".5"/>
  <ellipse cx="99" cy="74" rx="5.5" ry="4" fill="#2A1B10"/>
  <ellipse cx="100.6" cy="72.8" rx="1.6" ry="1.2" fill="#fff" opacity=".8"/>
  <path d="M92 64 C97 61, 105 62, 109 66" stroke="#2A1B10" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M96 98 C101 96, 106 96, 109 98" stroke="#8B5A38" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M42 78 C42 44, 66 30, 88 36 C104 40, 112 52, 114 62 C104 50, 86 44, 70 50 C56 55, 48 66, 46 84 Z" fill="url(#gHair)"/>
  <g id="hairTail">
    <path d="M50 60 C34 62, 22 76, 26 92 C34 82, 44 76, 54 76 Z" fill="url(#gHair)"/>
    <path d="M50 60 C36 64, 27 76, 29 88 C36 79, 45 74, 54 74 Z" fill="#8C6236" opacity=".35"/>
  </g>
  <path d="M46 84 C42 96, 44 106, 52 112 C46 100, 47 92, 50 84 Z" fill="#000" opacity=".3"/>
</g>
<g id="gorget">
  <path d="M56 112 C70 122, 94 120, 106 110 L106 120 C94 132, 68 132, 55 121 Z" fill="url(#gSteelD)"/>
  <path d="M56 112 C70 122, 94 120, 106 110 L105.6 112.5 C93 121.5, 70 123, 57 114 Z" fill="#A3AEC0" opacity=".45"/>
</g>
<g id="armFront"><path d="M92 122 L74 118 L64 124 L70 132 L84 130 L94 132 Z" fill="url(#gSteel)"/></g>
<g id="greatsword">
  <path d="M40 4 L54 8 L56 104 L42 104 Z" fill="url(#gBlade)"/>
  <path d="M47.4 8 L49 104" stroke="#1C212A" stroke-width="2.4" opacity=".7"/>
  <path d="M48.4 10 L50 102" stroke="#fff" stroke-width="1" opacity=".5"/>
  <path d="M40 4 L54 8 L47 -4 Z" fill="#EDF3FC"/>
  <g id="glow">
    <path d="M44 12 L45 100" stroke="#F4E2AC" stroke-width="1.6" opacity=".9"/>
    <path d="M48 12 L49 100" stroke="#F4E2AC" stroke-width="1.6" opacity=".9"/>
    <path d="M52 12 L53 100" stroke="#F4E2AC" stroke-width="1.6" opacity=".9"/>
  </g>
  <path d="M30 104 L66 107 L64 115 L32 112 Z" fill="url(#gGold)"/>
  <rect x="42" y="115" width="12" height="20" rx="4" fill="url(#gLeather)"/>
  <circle cx="48" cy="138" r="6" fill="url(#gGold)"/>
</g>`,
      notes:{
        walk:"가벼운 확신에 찬 걸음. 다리 ±27° 교차, 대검은 그립(48,122)을 축으로 어깨 위에서 38° 유지하며 걸음마다 2° 흔들립니다. 머리 뒤 묶은 머리(hairTail)가 머리보다 1프레임 늦게 스윙.",
        attack:"대검 횡베기. 그립(48,122)을 축으로 38°에서 -48°까지 뒤로 감았다가 128°까지 한 번에 쓸어내려, 검신이 정면을 완전히 관통합니다. 몸통이 스윙에 완전히 실려 회전하고 머리·치마가 관성으로 늦게 따라옵니다.",
        hit:"검을 놓지 않고 버티는 피격. 상체가 뒤로 젖혀지며 대검 무게 때문에 검이 뒤로 크게 흔들립니다.",
        death:"뒤로 넘어지며 대검을 놓침. 대검이 그립에서 회전해 땅으로 떨어지고, 검신의 황금 빛줄이 꺼집니다.",
        skill:"복리 참격 준비. 대검을 세워 정면에 겨누고 빛줄 3줄이 동시에 맥동, 무게 중심을 낮춥니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        if(mo==="walk"){
          const bob=-3*Math.abs(s);
          A.set("legBack",{r:[-27*s,68,146]});
          A.set("legFront",{r:[24*s,88,152]});
          A.set("torso",{t:[0,bob],r:[1.6*s,80,150]});
          A.set("gorget",{t:[0,bob],r:[1.6*s,80,118]});
          A.set("head",{t:[0,bob-0.7],r:[-1.6*s,80,110]});
          A.set("hairTail",{r:[-10*sin(PI2*(ph-0.16)),50,64]});
          A.set("armBack",{t:[0,bob],r:[10*s,78,114]});
          A.set("armFront",{t:[0,bob],r:[-5*s,90,124]});
          A.set("greatsword",{t:[0,bob],r:[38+2.5*s,48,122]});
          A.set("shadow",{s:[1-0.05*Math.abs(s),1,78,190]});
        } else if(mo==="attack"){
          const sw=TR(ph,[[0,38],[.3,-48],[.34,-52],[.52,128],[.62,120],[1,38]],"out");
          const fwd=TR(ph,[[0,0],[.3,-9],[.52,18],[.62,14],[1,0]],"out");
          const trot=TR(ph,[[0,0],[.3,-9],[.52,15],[.62,12],[1,0]],"out");
          A.set("greatsword",{t:[fwd,0],r:[sw,48,122]});
          A.set("glow",{});
          A.set("torso",{t:[fwd,0],r:[trot,80,150]});
          A.set("gorget",{t:[fwd,0],r:[trot,80,118]});
          A.set("head",{t:[fwd*0.95,0],r:[trot*0.6,80,110]});
          A.set("hairTail",{r:[TR(ph,[[0,0],[.3,26],[.55,-30],[.75,10],[1,0]],"out"),50,64]});
          A.set("armBack",{t:[fwd,0],r:[TR(ph,[[0,0],[.3,-26],[.52,34],[.62,28],[1,0]],"out"),78,114]});
          A.set("armFront",{t:[fwd,0],r:[TR(ph,[[0,0],[.3,-20],[.52,30],[.62,24],[1,0]],"out"),90,124]});
          A.set("legBack",{r:[TR(ph,[[0,0],[.3,14],[.52,-18],[.75,-8],[1,0]],"out"),68,150]});
          A.set("legFront",{r:[TR(ph,[[0,0],[.3,-8],[.52,16],[.75,9],[1,0]],"out"),88,157]});
          A.set("shadow",{t:[fwd*0.5,0]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("torso",{t:[-10*k,0],r:[-11*k,80,150]});
          A.set("gorget",{t:[-10*k,0],r:[-11*k,80,118]});
          A.set("head",{t:[-12*k,0],r:[-15*k,80,110]});
          A.set("hairTail",{r:[26*k,50,64]});
          A.set("legBack",{r:[-13*k,68,150]});
          A.set("legFront",{r:[-17*k,88,157],t:[-4*k,0]});
          A.set("armBack",{t:[-9*k,0],r:[-14*k,78,114]});
          A.set("armFront",{t:[-9*k,0],r:[-12*k,90,124]});
          A.set("greatsword",{t:[-9*k,0],r:[38-30*k,48,122]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.65*k})`);
        } else if(mo==="death"){
          const kn=S(ph,.05,.3), fall=H.inn(S(ph,.28,.72)), rest=S(ph,.72,.9), fade=S(ph,.86,1);
          A.set("root",{r:[-90*fall,80,188]});
          A.set("legBack",{r:[40*kn-16*fall,68,150]});
          A.set("legFront",{r:[-46*kn+20*fall,88,157]});
          A.set("torso",{t:[0,11*kn],r:[-7*kn,80,150]});
          A.set("gorget",{t:[0,11*kn],r:[-7*kn,80,118]});
          A.set("head",{t:[0,11*kn],r:[18*kn+20*fall,80,110]});
          A.set("hairTail",{r:[-34*fall-10*rest,50,64]});
          A.set("armBack",{t:[0,11*kn],r:[-40*fall,78,114]});
          A.set("armFront",{t:[0,11*kn],r:[-30*fall,90,124]});
          A.set("greatsword",{t:[10*fall,16*fall],r:[38+62*fall+14*rest,48,122]});
          A.set("glow",{o:1-S(ph,.2,.6)});
          A.set("shadow",{s:[1+0.25*fall,1-0.4*fade,78,190]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.55*fall}) brightness(${1-0.25*fall})`);
        } else {
          const r=S(ph,0,.32), p=sin(PI2*ph);
          A.set("legBack",{r:[-16*r,68,150]});
          A.set("legFront",{r:[16*r,88,157]});
          A.set("torso",{t:[0,4*r],r:[4*r,80,150]});
          A.set("gorget",{t:[0,4*r],r:[4*r,80,118]});
          A.set("head",{t:[0,4*r],r:[-3*r,80,110]});
          A.set("armBack",{t:[0,4*r],r:[-30*r,78,114]});
          A.set("armFront",{t:[0,4*r],r:[-24*r,90,124]});
          A.set("greatsword",{t:[0,4*r],r:[38+52*r+2*p,48,122]});
          A.filter(`drop-shadow(0 0 ${7+6*Math.abs(p)}px rgba(244,226,172,${.5+.3*Math.abs(p)}))`);
        }
      }
    };

    // ============ 3. ANALYST RANGER ============
    const ranger = {
      kr:"애널리스트 궁수", en:"Analyst Ranger", file:"assets/03-analyst-ranger.svg", vb:"0 0 175 205",
      parts:["shadow","quiver","legBack","torso","legFront","bow","string","arrow","drawArm","head","eye","cape"],
      markup:`
<g id="shadow"><ellipse cx="78" cy="190" rx="40" ry="5.5" fill="#000" opacity=".6"/></g>
<g id="quiver">
  <path d="M56 108 L44 96 L36 74 L44 70 L54 92 L64 104 Z" fill="url(#gLeather)"/>
  <path d="M38 72 L48 68 M40 78 L50 74" stroke="#C9B489" stroke-width="2.4"/>
</g>
<g id="legBack">
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="#2A2416"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="url(#gLeather)"/>
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="#000" opacity=".3"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="#000" opacity=".3"/>
</g>
<g id="torso">
  <path d="M58 116 C64 108, 94 106, 102 116 L106 142 C104 154, 92 160, 79 160 C65 160, 57 152, 55 142 Z" fill="url(#gGreen)"/>
  <path d="M98 114 C104 124, 106 138, 102 152 C99 158, 92 160, 86 160 C96 154, 100 140, 97 126 Z" fill="#A8C489" opacity=".22"/>
  <path d="M60 114 C54 126, 53 144, 58 155 C50 147, 50 126, 60 114 Z" fill="#000" opacity=".38"/>
  <path d="M62 118 L100 116 L102 134 L60 136 Z" fill="url(#gLeather)" opacity=".85"/>
  <path d="M62 118 L100 116 L100.4 119 L62.3 121 Z" fill="#9C7B4E" opacity=".5"/>
  <path d="M56 154 L106 152 L108 164 L54 166 Z" fill="#2C3A22"/>
  <rect x="55" y="148" width="50" height="7" rx="2" fill="url(#gLeather)"/>
  <rect x="82" y="146" width="12" height="10" rx="2" fill="url(#gGold)"/>
</g>
<g id="legFront">
  <path d="M80 156 L78 174 L96 176 L98 156 Z" fill="#3D5232"/>
  <path d="M74 174 L98 176 L110 184 L110 189 L72 187 Z" fill="url(#gLeather)"/>
</g>
<g id="bow">
  <path d="M118 52 C 136 76, 136 124, 118 148" stroke="url(#gWood)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M118 52 C 133 76, 133 124, 118 148" stroke="#C79556" stroke-width="1.6" fill="none" opacity=".5"/>
  <g id="string">
    <line id="s1" x1="118" y1="52" x2="86" y2="100" stroke="#D8D2C0" stroke-width="1.8"/>
    <line id="s2" x1="118" y1="148" x2="86" y2="100" stroke="#D8D2C0" stroke-width="1.8"/>
  </g>
  <g id="arrow">
    <path d="M86 100 L134 98" stroke="url(#gWood)" stroke-width="3"/>
    <path d="M134 98 L146 100 L134 102 Z" fill="#C0CAD8"/>
    <path d="M86 96 L94 100 L86 104 Z" fill="#B0442F"/>
  </g>
</g>
<g id="drawArm"><path d="M88 92 L74 90 L66 96 L72 106 L86 106 Z" fill="url(#gGreen)"/></g>
<g id="head">
  <path d="M42 78 C42 48, 60 34, 80 34 C100 34, 114 46, 117 66 C120 80, 117 96, 106 106 C95 116, 70 119, 55 109 C45 102, 42 90, 42 78 Z" fill="url(#gGreen)"/>
  <path d="M48 74 C48 50, 62 38, 80 38 C88 38, 95 40, 100 44 C90 40, 74 42, 63 54 C54 63, 50 72, 50 82 Z" fill="#8FAE70" opacity=".3"/>
  <path d="M42 78 C42 62, 48 50, 56 42 C48 54, 46 68, 48 82 C50 96, 58 106, 70 111 C56 109, 44 94, 42 78 Z" fill="#000" opacity=".4"/>
  <g id="hoodTail">
    <path d="M48 56 C30 50, 16 60, 14 76 C26 66, 38 64, 50 68 Z" fill="url(#gGreen)"/>
    <path d="M48 56 C32 52, 20 60, 17 72 C28 63, 39 62, 50 66 Z" fill="#000" opacity=".3"/>
  </g>
  <path d="M86 62 C100 58, 112 64, 118 74 C114 92, 102 106, 86 110 C76 112, 70 108, 68 102 C74 84, 78 68, 86 62 Z" fill="#0B0F0A"/>
  <g id="eye">
    <ellipse cx="102" cy="82" rx="7" ry="4.5" fill="#8FE08C" filter="url(#fWarm)" opacity=".9"/>
    <ellipse cx="103" cy="81" rx="2.4" ry="1.6" fill="#EFFFEA"/>
  </g>
  <path d="M100 96 C108 92, 114 92, 118 94 L 116 102 C 110 98, 104 99, 99 102 Z" fill="url(#gLeather)"/>
</g>
<g id="cape"><path d="M55 109 C68 119, 92 117, 105 106 L106 118 C92 130, 66 130, 54 119 Z" fill="url(#gGreen)"/></g>`,
      notes:{
        walk:"가볍고 빠른 걸음. 다리 ±29° 교차, 활은 그립(118,100)을 축으로 -32° 눕혀 한 손에 낮게 들고, 화살은 시위에서 빠져 숨습니다. 후드 꼬리·망토가 이동 방향 반대로 늘어집니다.",
        attack:"조준 → 발사. 시위 노크점을 (86,100)에서 (114,100)까지 3프레임에 스냅시켜 실제로 튕기고, 화살은 노크에서 분리돼 +x로 날아가며 소멸합니다. 어깨는 반동으로 뒤로 밀리고 초록 눈빛이 발사 순간 최대로 번쩍입니다.",
        hit:"활을 놓치지 않는 피격. 상체가 젖혀지고 시위가 이완되며 화살이 흔들립니다.",
        death:"뒤로 넘어지며 활을 떨어뜨림. 후드가 벗겨지듯 젖혀지고 초록 눈빛이 꺼집니다.",
        skill:"목표가 지정. 활을 정면으로 들어 완전히 당긴 상태로 고정하고, 초록 눈빛이 스캔하듯 맥동합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        const nock=(x)=>{ A.attr("s1","x2",x); A.attr("s2","x2",x); };
        if(mo==="walk"){
          const bob=-3.2*Math.abs(s);
          A.set("legBack",{r:[-29*s,68,146]});
          A.set("legFront",{r:[26*s,88,152]});
          A.set("torso",{t:[0,bob],r:[1.6*s,80,150]});
          A.set("quiver",{t:[0,bob],r:[3*s,56,106]});
          A.set("cape",{t:[0,bob],r:[-4*sin(PI2*(ph-0.18)),80,114]});
          A.set("head",{t:[0,bob-0.8],r:[-1.4*s,80,110]});
          A.set("hoodTail",{r:[-11*sin(PI2*(ph-0.2)),48,60]});
          A.set("bow",{t:[-16,bob+12],r:[-34+3*s,118,100]});
          A.set("arrow",{o:0});
          nock(112);
          A.set("drawArm",{t:[-6,bob+4],r:[-14*s,88,98]});
          A.set("eye",{});
          A.set("shadow",{s:[1-0.05*Math.abs(s),1,78,190]});
        } else if(mo==="attack"){
          const draw=TR(ph,[[0,86],[.34,82],[.4,114],[.46,111],[.6,112],[1,86]],"out");
          nock(draw);
          const fly=S(ph,.4,.78);
          A.set("arrow",{t:[fly*150,0],o: ph<.4?1: (fly<1? 1-Math.max(0,(fly-0.7)/0.3):0)});
          const rec=TR(ph,[[0,0],[.34,-4],[.42,9],[.6,4],[1,0]],"out");
          A.set("bow",{t:[-rec*0.6,0],r:[TR(ph,[[0,0],[.34,-2],[.42,4],[1,0]],"out"),118,100]});
          A.set("torso",{t:[-rec*0.5,0],r:[TR(ph,[[0,0],[.34,2],[.42,-4],[1,0]],"out"),80,150]});
          A.set("head",{t:[0,0],r:[TR(ph,[[0,0],[.34,1],[.42,-3],[1,0]],"out"),80,110]});
          A.set("hoodTail",{r:[TR(ph,[[0,0],[.42,-16],[.7,6],[1,0]],"out"),48,60]});
          A.set("drawArm",{t:[TR(ph,[[0,0],[.34,-3],[.42,26],[.6,24],[1,0]],"out"),0],r:[TR(ph,[[0,0],[.42,-8],[1,0]],"out"),88,98]});
          A.set("legBack",{r:[TR(ph,[[0,0],[.42,-8],[.7,-3],[1,0]],"out"),68,150]});
          A.set("legFront",{r:[TR(ph,[[0,0],[.42,6],[.7,2],[1,0]],"out"),88,157]});
          const flare=TR(ph,[[0,1],[.36,1.3],[.42,2.4],[.55,1.2],[1,1]],"out");
          A.set("eye",{s:[flare,flare,102,82]});
          A.set("quiver",{r:[-3*S(ph,.34,.5),56,106]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          nock(H.lerp(86,104,k));
          A.set("torso",{t:[-10*k,0],r:[-10*k,80,150]});
          A.set("head",{t:[-12*k,0],r:[-14*k,80,110]});
          A.set("hoodTail",{r:[24*k,48,60]});
          A.set("quiver",{t:[-9*k,0],r:[-8*k,56,106]});
          A.set("cape",{r:[10*k,80,114]});
          A.set("legBack",{r:[-12*k,68,150]});
          A.set("legFront",{r:[-16*k,88,157],t:[-4*k,0]});
          A.set("bow",{t:[-8*k,0],r:[-14*k,118,100]});
          A.set("drawArm",{t:[-10*k,0],r:[-12*k,88,98]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.65*k})`);
        } else if(mo==="death"){
          const kn=S(ph,.05,.3), fall=H.inn(S(ph,.28,.72)), rest=S(ph,.72,.9), fade=S(ph,.86,1);
          nock(H.lerp(86,116,S(ph,.1,.4)));
          A.set("root",{r:[-90*fall,80,188]});
          A.set("legBack",{r:[40*kn-16*fall,68,150]});
          A.set("legFront",{r:[-46*kn+20*fall,88,157]});
          A.set("torso",{t:[0,11*kn],r:[-7*kn,80,150]});
          A.set("head",{t:[0,11*kn],r:[18*kn+20*fall,80,110]});
          A.set("hoodTail",{r:[-40*fall-12*rest,48,60]});
          A.set("quiver",{t:[0,11*kn],r:[-16*fall,56,106]});
          A.set("cape",{r:[-18*fall,80,114]});
          A.set("bow",{t:[14*fall,20*fall],r:[-70*fall-16*rest,118,100]});
          A.set("arrow",{o:1-S(ph,.15,.45)});
          A.set("drawArm",{t:[0,11*kn],r:[-34*fall,88,98]});
          A.set("eye",{o:1-S(ph,.25,.6)});
          A.set("shadow",{s:[1+0.25*fall,1-0.4*fade,78,190]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.55*fall}) brightness(${1-0.25*fall})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          nock(H.lerp(86,80,r));
          A.set("legBack",{r:[-14*r,68,150]});
          A.set("legFront",{r:[14*r,88,157]});
          A.set("torso",{t:[0,3*r],r:[2*r,80,150]});
          A.set("head",{t:[0,3*r],r:[-2*r,80,110]});
          A.set("bow",{t:[4*r,0],r:[2*r,118,100]});
          A.set("drawArm",{t:[-6*r,0],r:[-4*r,88,98]});
          const fl=1+0.5*Math.abs(p);
          A.set("eye",{s:[fl,fl,102,82]});
          A.filter(`drop-shadow(0 0 ${5+6*Math.abs(p)}px rgba(143,224,140,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 4. DIVERSIFIED LANCER ============
    const lancer = {
      kr:"분산투자 창병", en:"Diversified Lancer", file:"assets/04-diversified-lancer.svg", vb:"0 -10 195 215",
      parts:["shadow","legBack","torso","armBack","legFront","head","hat","gorget","armFront","halberd"],
      markup:`
<g id="shadow"><ellipse cx="78" cy="190" rx="40" ry="5.5" fill="#000" opacity=".6"/></g>
<g id="legBack">
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="url(#gSteelD)"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="url(#gSteelD)"/>
  <path d="M58 138 L56 168 L74 170 L76 138 Z" fill="#000" opacity=".34"/>
  <path d="M52 168 L76 170 L88 178 L88 183 L50 181 Z" fill="#000" opacity=".34"/>
</g>
<g id="torso">
  <path d="M58 118 L106 116 L108 146 L56 148 Z" fill="url(#pMail)"/>
  <path d="M58 116 C64 108, 94 106, 102 116 L106 142 C104 154, 92 160, 79 160 C65 160, 57 152, 55 142 Z" fill="url(#gSteel)"/>
  <path d="M98 114 C104 124, 106 138, 102 152 C99 158, 92 160, 86 160 C96 154, 100 140, 97 126 Z" fill="#DCE5F2" opacity=".25"/>
  <path d="M60 114 C54 126, 53 144, 58 155 C50 147, 50 126, 60 114 Z" fill="#000" opacity=".33"/>
  <path d="M56 154 L106 152 L108 164 L54 166 Z" fill="url(#gSteelD)"/>
  <rect x="55" y="148" width="50" height="7" rx="2" fill="url(#gLeather)"/>
  <rect x="82" y="146" width="12" height="10" rx="2" fill="url(#gGold)"/>
</g>
<g id="armBack">
  <path d="M48 122 C48 106, 72 100, 82 110 L 78 122 C 70 114, 55 116, 52 128 Z" fill="url(#gSteel)"/>
  <path d="M48 122 C48 106, 72 100, 82 110 L80 113 C70 104, 53 110, 51 124 Z" fill="#E4EBF7" opacity=".38"/>
</g>
<g id="legFront">
  <path d="M80 156 L78 174 L96 176 L98 156 Z" fill="url(#gSteel)"/>
  <path d="M74 174 L98 176 L110 184 L110 189 L72 187 Z" fill="url(#gSteelD)"/>
</g>
<g id="head">
  <path d="M42 78 C42 48, 60 34, 80 34 C100 34, 114 46, 117 66 C120 80, 117 96, 106 106 C95 116, 70 119, 55 109 C45 102, 42 90, 42 78 Z" fill="url(#gSkin)"/>
  <path d="M42 78 C42 66, 46 56, 52 48 C46 60, 44 72, 46 86 C48 98, 56 106, 68 111 C54 109, 44 94, 42 78 Z" fill="#000" opacity=".35"/>
  <ellipse cx="98" cy="80" rx="5" ry="3.6" fill="#2A1B10"/>
  <ellipse cx="99.4" cy="79" rx="1.4" ry="1" fill="#fff" opacity=".75"/>
  <path d="M96 96 C102 94, 108 94, 111 96" stroke="#8B5A38" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <g id="hat">
    <path d="M26 70 C 40 44, 74 32, 100 40 C 118 46, 128 58, 130 70 C 112 60, 96 56, 78 58 C 58 60, 40 64, 26 70 Z" fill="url(#gSteel)"/>
    <path d="M34 66 C48 46, 76 38, 98 44 C110 48, 118 54, 122 62 C108 52, 90 48, 72 50 C56 52, 44 58, 34 66 Z" fill="#EAF0FB" opacity=".38"/>
    <path d="M26 70 C 46 62, 78 56, 104 60 C 118 62, 126 66, 130 70 C 126 76, 112 78, 92 78 C 62 78, 38 76, 26 70 Z" fill="url(#gSteelD)"/>
    <path d="M26 70 C 46 62, 78 56, 104 60 C 118 62, 126 66, 130 70 L 129 71.6 C 120 66, 100 62, 78 62 C 54 62, 34 66, 26.6 71 Z" fill="#A3AEC0" opacity=".45"/>
  </g>
</g>
<g id="gorget"><path d="M55 109 C68 119, 92 117, 105 106 L106 118 C92 130, 66 130, 54 119 Z" fill="url(#gSteelD)"/></g>
<g id="armFront"><path d="M64 132 L82 122 L92 128 L86 138 L72 142 Z" fill="url(#gSteel)"/></g>
<g id="halberd">
  <path d="M28 178 L128 24" stroke="url(#gWood)" stroke-width="7" stroke-linecap="round"/>
  <path d="M30 176 L126 26" stroke="#C79556" stroke-width="1.6" opacity=".4"/>
  <path d="M128 24 L136 8 L140 26 L132 34 Z" fill="url(#gBlade)"/>
  <path d="M120 38 C 136 34, 146 44, 142 58 C 132 50, 126 46, 116 46 Z" fill="url(#gBlade)"/>
  <path d="M120 38 C 133 35, 142 42, 141 52 C 132 45, 126 43, 117 43 Z" fill="#F2F7FF" opacity=".45"/>
  <path d="M112 48 L104 58 L110 62 L118 52 Z" fill="url(#gSteelD)"/>
</g>`,
      notes:{
        walk:"규율 잡힌 행군. 다리 ±25° 교차, 할버드는 그립(74,124)을 축으로 어깨 각도를 유지하며 ±3.5°만 흔들립니다. 케틀햇 챙은 몸통 회전을 역보정해 항상 완벽히 수평 — 표정이 안 보이는 실루엣이 유지됩니다.",
        attack:"직선 관통 찌르기. 할버드가 그립(78,136)을 축으로 +57° 회전해 대각선에서 완전 수평이 되고, 창끝(스파이크)이 정면 +x를 정확히 향한 상태로 축 방향으로 32px 내질러집니다. 자루 뒤끝은 겨드랑이 아래로 빠져 얼굴을 가리지 않고, 두 팔이 앞으로 잠기며 챙이 전방 런지로 기울어집니다.",
        hit:"자루로 받아내는 피격. 몸통이 젖혀지고 할버드가 뒤로 밀리며 챙이 흔들립니다.",
        death:"뒤로 넘어지며 할버드를 놓침. 자루가 회전해 땅에 눕고 케틀햇이 굴러 벗겨집니다.",
        skill:"리밸런싱. 할버드를 완전 수평으로 정면 고정하고 두 발을 넓게 벌려 관통 준비 자세를 잡습니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        if(mo==="walk"){
          const bob=-2.6*Math.abs(s);
          A.set("legBack",{r:[-25*s,68,146]});
          A.set("legFront",{r:[22*s,88,152]});
          A.set("torso",{t:[0,bob],r:[1.3*s,80,150]});
          A.set("gorget",{t:[0,bob],r:[1.3*s,80,116]});
          A.set("head",{t:[0,bob-0.6],r:[-1.1*s,80,110]});
          A.set("hat",{r:[1.1*s,78,70]});
          A.set("armBack",{t:[0,bob],r:[7*s,78,116]});
          A.set("armFront",{t:[0,bob],r:[-4*s,78,132]});
          A.set("halberd",{t:[0,bob],r:[3.5*s,74,124]});
          A.set("shadow",{s:[1-0.05*Math.abs(s),1,78,190]});
        } else if(mo==="attack"){
          const rot=TR(ph,[[0,0],[.24,-8],[.44,57],[.6,57],[1,0]],"out");
          const push=TR(ph,[[0,0],[.24,-8],[.46,32],[.6,26],[1,0]],"out");
          const fwd=TR(ph,[[0,0],[.24,-7],[.46,17],[.6,13],[1,0]],"out");
          A.set("halberd",{t:[push,6*S(ph,.24,.46)],r:[rot,78,136]});
          A.set("torso",{t:[fwd,0],r:[TR(ph,[[0,0],[.24,-4],[.46,7],[1,0]],"out"),80,150]});
          A.set("gorget",{t:[fwd,0],r:[TR(ph,[[0,0],[.46,7],[1,0]],"out"),80,116]});
          A.set("head",{t:[fwd,0],r:[TR(ph,[[0,0],[.46,5],[1,0]],"out"),80,110]});
          A.set("hat",{r:[TR(ph,[[0,0],[.24,-3],[.46,9],[.7,4],[1,0]],"out"),78,70]});
          A.set("armBack",{t:[TR(ph,[[0,0],[.24,-8],[.46,28],[.6,23],[1,0]],"out"),0],r:[TR(ph,[[0,0],[.46,22],[1,0]],"out"),78,116]});
          A.set("armFront",{t:[TR(ph,[[0,0],[.24,-6],[.46,30],[.6,25],[1,0]],"out"),0],r:[TR(ph,[[0,0],[.46,-14],[1,0]],"out"),78,132]});
          A.set("legBack",{r:[TR(ph,[[0,0],[.24,12],[.46,-20],[.75,-9],[1,0]],"out"),68,150]});
          A.set("legFront",{r:[TR(ph,[[0,0],[.24,-7],[.46,15],[.75,8],[1,0]],"out"),88,157]});
          A.set("shadow",{t:[fwd*0.5,0]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("torso",{t:[-9*k,0],r:[-10*k,80,150]});
          A.set("gorget",{t:[-9*k,0],r:[-10*k,80,116]});
          A.set("head",{t:[-11*k,0],r:[-13*k,80,110]});
          A.set("hat",{r:[-18*k,78,70]});
          A.set("legBack",{r:[-12*k,68,150]});
          A.set("legFront",{r:[-16*k,88,157],t:[-4*k,0]});
          A.set("armBack",{t:[-9*k,0],r:[-13*k,78,116]});
          A.set("armFront",{t:[-9*k,0],r:[-11*k,78,132]});
          A.set("halberd",{t:[-11*k,0],r:[-16*k,74,124]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.65*k})`);
        } else if(mo==="death"){
          const kn=S(ph,.05,.3), fall=H.inn(S(ph,.28,.72)), rest=S(ph,.72,.9), fade=S(ph,.86,1);
          A.set("root",{r:[-90*fall,80,188]});
          A.set("legBack",{r:[40*kn-16*fall,68,150]});
          A.set("legFront",{r:[-46*kn+20*fall,88,157]});
          A.set("torso",{t:[0,11*kn],r:[-7*kn,80,150]});
          A.set("gorget",{t:[0,11*kn],r:[-7*kn,80,116]});
          A.set("head",{t:[0,11*kn],r:[18*kn+20*fall,80,110]});
          A.set("hat",{t:[-22*fall,-6*fall+16*rest],r:[-90*fall-40*rest,78,70]});
          A.set("armBack",{t:[0,11*kn],r:[-36*fall,78,116]});
          A.set("armFront",{t:[0,11*kn],r:[-28*fall,78,132]});
          A.set("halberd",{t:[8*fall,18*fall],r:[54*fall+14*rest,74,124]});
          A.set("shadow",{s:[1+0.25*fall,1-0.4*fade,78,190]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.55*fall}) brightness(${1-0.25*fall})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("legBack",{r:[-20*r,68,150]});
          A.set("legFront",{r:[20*r,88,157]});
          A.set("torso",{t:[0,3*r],r:[3*r,80,150]});
          A.set("gorget",{t:[0,3*r],r:[3*r,80,116]});
          A.set("head",{t:[0,3*r],r:[2*r,80,110]});
          A.set("hat",{r:[-2*r,78,70]});
          A.set("armBack",{t:[16*r,0],r:[20*r,78,116]});
          A.set("armFront",{t:[18*r,0],r:[-12*r,78,132]});
          A.set("halberd",{t:[20*r,0],r:[62*r+1.5*p,74,124]});
          A.filter(`drop-shadow(0 0 ${6+5*Math.abs(p)}px rgba(244,249,255,${.4+.3*Math.abs(p)}))`);
        }
      }
    };

    // ============ 5. DIVIDEND CLERIC ============
    const cleric = {
      kr:"배당 사제", en:"Dividend Cleric", file:"assets/05-dividend-cleric.svg", vb:"0 -10 175 215",
      parts:["shadow","aura","staff","sunring","robe","hem","belt","sleeve","head","hoodTail","eye","cape"],
      markup:`
<g id="shadow"><ellipse cx="78" cy="190" rx="40" ry="5.5" fill="#000" opacity=".6"/></g>
<g id="aura">
  <ellipse cx="78" cy="186" rx="46" ry="9" fill="#FFE9A8" opacity=".28" filter="url(#fSoft)"/>
  <ellipse cx="78" cy="186" rx="34" ry="6" fill="none" stroke="#FFE9A8" stroke-width="1.6" opacity=".7"/>
</g>
<g id="staff">
  <path d="M118 46 L112 178" stroke="url(#gWood)" stroke-width="6" stroke-linecap="round"/>
  <g id="sunring">
    <g filter="url(#fWarm)">
      <circle cx="119" cy="40" r="11" fill="none" stroke="url(#gGold)" stroke-width="4"/>
      <path d="M119 24 L119 56 M104 40 L134 40" stroke="#FFE9A8" stroke-width="3" stroke-linecap="round"/>
    </g>
    <circle cx="119" cy="40" r="5" fill="#FFF6D6" filter="url(#fWarm)"/>
  </g>
</g>
<g id="robe">
  <path d="M60 118 C66 110, 92 108, 100 118 L112 176 C 96 184, 62 184, 46 176 Z" fill="url(#gWhite)"/>
  <path d="M96 116 C106 134, 112 158, 112 176 C 104 180, 96 182, 88 183 C 96 160, 96 134, 92 116 Z" fill="#FFFDF4" opacity=".35"/>
  <path d="M62 116 C52 136, 46 160, 46 176 C 54 180, 62 182, 70 183 C 62 158, 60 134, 66 116 Z" fill="#000" opacity=".3"/>
  <path d="M79 112 C76 138, 76 160, 79 182" stroke="#8E8672" stroke-width="2" fill="none" opacity=".55"/>
</g>
<g id="hem"><path d="M46 176 C 62 184, 96 184, 112 176 L 113 182 C 96 190, 62 190, 45 182 Z" fill="url(#gGold)"/></g>
<g id="belt"><rect x="56" y="140" width="48" height="7" rx="2" fill="url(#gGold)"/></g>
<g id="sleeve"><path d="M100 122 L112 128 L108 138 L96 132 Z" fill="url(#gWhite)"/></g>
<g id="head">
  <path d="M42 78 C42 48, 60 34, 80 34 C100 34, 114 46, 117 66 C120 80, 117 96, 106 106 C95 116, 70 119, 55 109 C45 102, 42 90, 42 78 Z" fill="url(#gWhite)"/>
  <path d="M48 74 C48 50, 62 38, 80 38 C88 38, 95 40, 100 44 C90 40, 74 42, 63 54 C54 63, 50 72, 50 82 Z" fill="#FFFDF4" opacity=".45"/>
  <path d="M42 78 C42 62, 48 50, 56 42 C48 54, 46 68, 48 82 C50 96, 58 106, 70 111 C56 109, 44 94, 42 78 Z" fill="#000" opacity=".28"/>
  <g id="hoodTail">
    <path d="M50 58 C32 54, 18 66, 18 82 C30 70, 40 66, 52 70 Z" fill="url(#gWhite)"/>
    <path d="M50 58 C34 56, 22 66, 21 78 C32 69, 41 66, 52 68 Z" fill="#000" opacity=".22"/>
  </g>
  <path d="M86 62 C100 58, 112 64, 118 74 C114 92, 102 106, 86 110 C76 112, 70 108, 68 102 C74 84, 78 68, 86 62 Z" fill="#2A2418"/>
  <g id="eye"><ellipse cx="102" cy="82" rx="7" ry="4.5" fill="#FFE9A8" filter="url(#fWarm)" opacity=".95"/></g>
  <path d="M60 44 C 74 34, 98 36, 110 48" stroke="url(#gGold)" stroke-width="3" fill="none"/>
  <path d="M104 100 C 110 96, 116 96, 120 98 L 118 106 C 112 102, 106 103, 102 106 Z" fill="url(#gGold)"/>
</g>
<g id="cape">
  <path d="M55 109 C68 119, 92 117, 105 106 L106 118 C92 130, 66 130, 54 119 Z" fill="url(#gWhite)"/>
  <path d="M55 109 C68 119, 92 117, 105 106 L105 110 C92 121, 68 122, 55 113 Z" fill="url(#gGold)" opacity=".8"/>
</g>`,
      notes:{
        walk:"발이 없는 활강. 다리 파츠가 아예 없고 로브(robe)를 좌우 skew + scaleY로 물결치게 만들어 미끄러지는 이동을 만듭니다. 지팡이는 그립(114,122)을 축으로 리듬을 맞춰 짚고, 후드 꼬리가 늦게 따라옵니다. 발밑 황금 아우라가 이동에 맞춰 늘어납니다.",
        attack:"시전 (공격 없음). 지팡이를 두 손으로 머리 위로 들어올려 그립을 축으로 -22° 세우고 12px 상승, 태양 링(sunring)이 1.9배로 부풀며 최대 발광합니다. 로브가 상승 기류에 들립니다.",
        hit:"로브가 젖혀지는 피격. 지팡이를 놓지 않고 몸이 뒤로 밀리며 황금 눈빛이 흔들립니다.",
        death:"발이 없으므로 넘어지지 않고 로브가 주저앉습니다. scaleY로 무너지며 지팡이가 앞으로 넘어지고 태양 링이 꺼집니다.",
        skill:"배당 지급. 지팡이를 정면에 세우고 링을 최대로 밝히며, 아우라 링이 지면에서 확장 맥동합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph), s2=sin(PI2*ph*2);
        if(mo==="walk"){
          A.set("robe",{k:[1.6*s,80,176],s:[1+0.012*s2,1-0.012*s2,80,176]});
          A.set("hem",{k:[1.8*s,80,180],t:[0.8*s,0]});
          A.set("belt",{t:[0.6*s,-1*Math.abs(s)]});
          A.set("head",{t:[0.7*s,-1.4*Math.abs(s)],r:[-1*s,80,110]});
          A.set("hoodTail",{r:[-9*sin(PI2*(ph-0.2)),50,62]});
          A.set("cape",{t:[0.7*s,-1.4*Math.abs(s)],r:[-3*sin(PI2*(ph-0.16)),80,114]});
          A.set("sleeve",{t:[0.7*s,-1*Math.abs(s)]});
          A.set("staff",{r:[4*s,114,122],t:[0,-1.2*Math.abs(s)]});
          A.set("aura",{s:[1+0.06*Math.abs(s),1-0.1*Math.abs(s),78,186]});
        } else if(mo==="attack"){
          const up=TR(ph,[[0,0],[.38,1],[.68,1],[1,0]],"out");
          A.set("staff",{t:[-2*up,-13*up],r:[-22*up,114,122]});
          const ring=1+0.9*TR(ph,[[0,0],[.4,1],[.66,.85],[1,0]],"out");
          A.set("sunring",{s:[ring,ring,119,40]});
          A.set("robe",{s:[1,1+0.03*up,80,180],t:[0,-3*up]});
          A.set("hem",{t:[0,-2*up]});
          A.set("belt",{t:[0,-4*up]});
          A.set("head",{t:[0,-5*up],r:[-3*up,80,110]});
          A.set("hoodTail",{r:[-14*up,50,62]});
          A.set("cape",{t:[0,-5*up],r:[-6*up,80,114]});
          A.set("sleeve",{t:[3*up,-9*up],r:[-24*up,100,128]});
          A.set("aura",{s:[1+0.3*up,1+0.2*up,78,186],o:0.5+0.5*up});
          A.filter(`drop-shadow(0 0 ${4+16*up}px rgba(255,233,168,${.3+.5*up}))`);
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("robe",{t:[-8*k,0],k:[-7*k,80,176]});
          A.set("hem",{t:[-7*k,0],k:[-8*k,80,180]});
          A.set("belt",{t:[-9*k,0]});
          A.set("head",{t:[-12*k,0],r:[-12*k,80,110]});
          A.set("hoodTail",{r:[22*k,50,62]});
          A.set("cape",{t:[-11*k,0],r:[9*k,80,114]});
          A.set("sleeve",{t:[-10*k,0]});
          A.set("staff",{t:[-9*k,0],r:[-12*k,114,122]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.65*k})`);
        } else if(mo==="death"){
          const col=H.inn(S(ph,.1,.72)), fade=S(ph,.7,1);
          A.set("robe",{s:[1+0.12*col,1-0.46*col,80,182],k:[-3*col,80,182]});
          A.set("hem",{s:[1+0.14*col,1,80,182]});
          A.set("belt",{t:[0,26*col],s:[1+0.06*col,1,80,144]});
          A.set("head",{t:[-4*col,40*col],r:[-16*col,80,110]});
          A.set("hoodTail",{r:[-30*col,50,62]});
          A.set("cape",{t:[-3*col,38*col],r:[-12*col,80,114]});
          A.set("sleeve",{t:[0,34*col],r:[-20*col,100,128]});
          A.set("staff",{t:[10*col,16*col],r:[62*col,114,122]});
          A.set("sunring",{o:1-S(ph,.1,.5),s:[1-0.4*col,1-0.4*col,119,40]});
          A.set("eye",{o:1-S(ph,.15,.5)});
          A.set("aura",{o:Math.max(0,0.9-1.4*col)});
          A.set("shadow",{s:[1+0.1*col,1-0.5*fade,78,190]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*col}) brightness(${1-0.2*col})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("staff",{t:[3*r,0],r:[-6*r,114,122]});
          const ring=1+0.35*r+0.12*Math.abs(p);
          A.set("sunring",{s:[ring,ring,119,40]});
          A.set("head",{t:[0,-2*r]});
          A.set("cape",{t:[0,-2*r]});
          A.set("belt",{t:[0,-2*r]});
          A.set("robe",{t:[0,-1*r]});
          A.set("aura",{s:[1+0.25*r+0.12*Math.abs(p),1+0.15*r,78,186],o:0.6+0.4*Math.abs(p)});
          A.filter(`drop-shadow(0 0 ${8+8*Math.abs(p)}px rgba(255,233,168,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 6. LEVERAGE MAGE ============
    const mage = {
      kr:"레버리지 술사", en:"Leverage Mage", file:"assets/06-leverage-mage.svg", vb:"0 -10 185 215",
      parts:["shadow","staff","orb","embers","robe","hem","belt","sleeve","head","hoodTail","eye","cape"],
      markup:`
<g id="shadow"><ellipse cx="78" cy="190" rx="40" ry="5.5" fill="#000" opacity=".6"/></g>
<g id="staff">
  <path d="M116 52 L110 178" stroke="url(#gWood)" stroke-width="6" stroke-linecap="round"/>
  <g id="orb">
    <g filter="url(#fSoft)"><circle cx="118" cy="40" r="16" fill="#FF8A2B" opacity=".55"/></g>
    <circle cx="118" cy="40" r="11" fill="url(#gFlame)"/>
    <circle cx="116" cy="37" r="4.5" fill="#FFF3B0"/>
  </g>
</g>
<g id="embers">
  <circle cx="134" cy="22" r="2.6" fill="#FFB347" opacity=".85" filter="url(#fWarm)"/>
  <circle cx="104" cy="18" r="1.8" fill="#FFB347" opacity=".7" filter="url(#fWarm)"/>
  <circle cx="130" cy="60" r="2" fill="#FF8A2B" opacity=".7" filter="url(#fWarm)"/>
</g>
<g id="robe">
  <path d="M60 118 C66 110, 92 108, 100 118 L112 176 C 96 184, 62 184, 46 176 Z" fill="url(#gViolet)"/>
  <path d="M96 116 C106 134, 112 158, 112 176 C 104 180, 96 182, 88 183 C 96 160, 96 134, 92 116 Z" fill="#A98BE0" opacity=".28"/>
  <path d="M62 116 C52 136, 46 160, 46 176 C 54 180, 62 182, 70 183 C 62 158, 60 134, 66 116 Z" fill="#000" opacity=".42"/>
</g>
<g id="hem"><path d="M46 176 C 62 184, 96 184, 112 176 L 113 182 C 96 190, 62 190, 45 182 Z" fill="url(#gGold)" opacity=".85"/></g>
<g id="belt">
  <rect x="56" y="140" width="48" height="7" rx="2" fill="url(#gLeather)"/>
  <rect x="74" y="138" width="13" height="11" rx="2" fill="url(#gGold)"/>
</g>
<g id="sleeve"><path d="M100 124 L112 130 L108 140 L96 134 Z" fill="url(#gViolet)"/></g>
<g id="head">
  <path d="M42 78 C42 48, 60 34, 80 34 C100 34, 114 46, 117 66 C120 80, 117 96, 106 106 C95 116, 70 119, 55 109 C45 102, 42 90, 42 78 Z" fill="url(#gViolet)"/>
  <path d="M48 74 C48 50, 62 38, 80 38 C88 38, 95 40, 100 44 C90 40, 74 42, 63 54 C54 63, 50 72, 50 82 Z" fill="#B79CE8" opacity=".3"/>
  <path d="M42 78 C42 62, 48 50, 56 42 C48 54, 46 68, 48 82 C50 96, 58 106, 70 111 C56 109, 44 94, 42 78 Z" fill="#000" opacity=".45"/>
  <g id="hoodTail">
    <path d="M46 54 C26 46, 8 58, 8 76 C22 62, 34 60, 48 66 Z" fill="url(#gViolet)"/>
    <path d="M46 54 C28 48, 13 58, 11 72 C24 60, 35 58, 48 64 Z" fill="#000" opacity=".35"/>
  </g>
  <path d="M84 60 C100 56, 112 62, 119 74 C115 92, 102 106, 86 110 C76 112, 68 108, 66 102 C72 82, 76 66, 84 60 Z" fill="#07050D"/>
  <g id="eye">
    <ellipse cx="102" cy="82" rx="7.5" ry="4.6" fill="#C89BFF" filter="url(#fWarm)"/>
    <ellipse cx="103" cy="81" rx="2.6" ry="1.6" fill="#F6ECFF"/>
  </g>
  <path d="M58 46 C 74 34, 100 36, 112 50" stroke="url(#gGold)" stroke-width="2.6" fill="none" opacity=".8"/>
  <path d="M104 100 C 110 96, 116 96, 120 98 L 118 106 C 112 102, 106 103, 102 106 Z" fill="url(#gViolet)"/>
</g>
<g id="cape"><path d="M55 109 C68 119, 92 117, 105 106 L106 118 C92 130, 66 130, 54 119 Z" fill="url(#gViolet)"/></g>`,
      notes:{
        walk:"무거운 보라 로브의 활강. 로브를 skew로 흔들고, 화염 오브(orb)는 지팡이보다 정확히 1프레임(0.14 위상) 늦게 따라오며 별도로 상하 진동합니다. 잉걸불(embers)은 진행 반대 방향으로 흘러갑니다.",
        attack:"완드 사출. 지팡이가 그립(112,124)을 축으로 +58° 회전해 완드 머리가 정면 +x를 향하고, 오브가 3중으로 1.75배까지 부풀었다가 지팡이에서 분리돼 +x로 발사됩니다. 발사 직후 지팡이가 반동으로 뒤로 젖혀지고 보라 눈빛이 최대 발광합니다.",
        hit:"로브가 젖혀지는 피격. 오브가 크게 흔들리고 지팡이가 뒤로 밀립니다.",
        death:"로브가 주저앉으며 소멸. 오브의 화염이 꺼져 축소되고 지팡이가 앞으로 넘어집니다. (골드 0 → 마진콜 강제 소멸)",
        skill:"몰빵. 지팡이를 정면으로 겨누고 오브를 최대 2.2배까지 과충전한 상태로 맥동 유지합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph), sl=sin(PI2*(ph-0.14));
        if(mo==="walk"){
          A.set("robe",{k:[1.8*s,80,176],s:[1+0.014*sin(PI2*ph*2),1-0.014*sin(PI2*ph*2),80,176]});
          A.set("hem",{k:[2*s,80,180],t:[0.9*s,0]});
          A.set("belt",{t:[0.7*s,-1.2*Math.abs(s)]});
          A.set("head",{t:[0.8*s,-1.6*Math.abs(s)],r:[-1.2*s,80,110]});
          A.set("hoodTail",{r:[-10*sin(PI2*(ph-0.22)),46,58]});
          A.set("cape",{t:[0.8*s,-1.6*Math.abs(s)],r:[-3.5*sl,80,114]});
          A.set("sleeve",{t:[0.8*s,-1.2*Math.abs(s)]});
          A.set("staff",{r:[4.5*s,112,124],t:[0,-1.4*Math.abs(s)]});
          A.set("orb",{t:[1.6*sl,-3.4*sl]});
          A.set("embers",{t:[-6-4*s,-3*s],o:0.85});
        } else if(mo==="attack"){
          const aim=TR(ph,[[0,0],[.2,-10],[.42,58],[.56,58],[.66,44],[1,0]],"out");
          const charge=TR(ph,[[0,1],[.2,1.15],[.34,1.5],[.46,1.75],[.5,1.8],[.54,0.2],[1,1]],"out");
          const launch=S(ph,.5,.86);
          A.set("staff",{r:[aim,112,124],t:[TR(ph,[[0,0],[.42,6],[.54,-9],[.66,-5],[1,0]],"out"),0]});
          A.set("orb",{s:[charge,charge,118,40],t:[launch*160,launch*-8],o: ph<.5?1:(1-Math.max(0,(launch-0.55)/0.45))});
          A.set("embers",{t:[-4+launch*40,-2-launch*14],o:0.9*(1-launch)});
          A.set("robe",{k:[TR(ph,[[0,0],[.2,3],[.54,-5],[1,0]],"out"),80,176]});
          A.set("hem",{k:[TR(ph,[[0,0],[.54,-6],[1,0]],"out"),80,180]});
          A.set("belt",{t:[TR(ph,[[0,0],[.42,4],[.54,-5],[1,0]],"out"),0]});
          A.set("head",{t:[TR(ph,[[0,0],[.42,5],[.54,-6],[1,0]],"out"),0],r:[TR(ph,[[0,0],[.42,4],[.54,-6],[1,0]],"out"),80,110]});
          A.set("hoodTail",{r:[TR(ph,[[0,0],[.42,-12],[.6,16],[1,0]],"out"),46,58]});
          A.set("cape",{t:[TR(ph,[[0,0],[.54,-6],[1,0]],"out"),0],r:[TR(ph,[[0,0],[.54,-10],[1,0]],"out"),80,114]});
          A.set("sleeve",{t:[TR(ph,[[0,0],[.42,12],[.56,10],[1,0]],"out"),TR(ph,[[0,0],[.42,-6],[1,0]],"out")],r:[TR(ph,[[0,0],[.42,-30],[.56,-26],[1,0]],"out"),100,130]});
          const fl=1+1.1*TR(ph,[[0,0],[.42,.5],[.52,1],[.7,.3],[1,0]],"out");
          A.set("eye",{s:[fl,fl,102,82]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("robe",{t:[-8*k,0],k:[-7*k,80,176]});
          A.set("hem",{t:[-7*k,0],k:[-8*k,80,180]});
          A.set("belt",{t:[-9*k,0]});
          A.set("head",{t:[-12*k,0],r:[-13*k,80,110]});
          A.set("hoodTail",{r:[24*k,46,58]});
          A.set("cape",{t:[-11*k,0],r:[10*k,80,114]});
          A.set("sleeve",{t:[-10*k,0]});
          A.set("staff",{t:[-10*k,0],r:[-14*k,112,124]});
          A.set("orb",{t:[-10*k,-6*k],s:[1-0.15*k,1-0.15*k,118,40]});
          A.set("embers",{o:0.4});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.65*k})`);
        } else if(mo==="death"){
          const col=H.inn(S(ph,.1,.72)), fade=S(ph,.7,1);
          A.set("robe",{s:[1+0.12*col,1-0.48*col,80,182],k:[-4*col,80,182]});
          A.set("hem",{s:[1+0.14*col,1,80,182]});
          A.set("belt",{t:[0,28*col],s:[1+0.06*col,1,80,144]});
          A.set("head",{t:[-4*col,42*col],r:[-18*col,80,110]});
          A.set("hoodTail",{r:[-32*col,46,58]});
          A.set("cape",{t:[-3*col,40*col],r:[-14*col,80,114]});
          A.set("sleeve",{t:[0,36*col],r:[-22*col,100,130]});
          A.set("staff",{t:[12*col,18*col],r:[66*col,112,124]});
          A.set("orb",{s:[Math.max(0.05,1-1.05*col),Math.max(0.05,1-1.05*col),118,40],o:Math.max(0,1-1.3*col)});
          A.set("embers",{o:Math.max(0,0.9-1.6*col),t:[0,-10*col]});
          A.set("eye",{o:1-S(ph,.15,.5)});
          A.set("shadow",{s:[1+0.1*col,1-0.5*fade,78,190]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*col}) brightness(${1-0.2*col})`);
        } else {
          const r=S(ph,0,.32), p=sin(PI2*ph);
          A.set("staff",{r:[54*r,112,124],t:[4*r,0]});
          const ch=1+1.2*r+0.18*Math.abs(p);
          A.set("orb",{s:[ch,ch,118,40]});
          A.set("embers",{t:[6*r,-4-4*Math.abs(p)],o:0.9});
          A.set("head",{t:[3*r,0],r:[3*r,80,110]});
          A.set("cape",{t:[3*r,0]});
          A.set("belt",{t:[3*r,0]});
          A.set("sleeve",{t:[9*r,-4*r],r:[-26*r,100,130]});
          const fl=1+0.6*r+0.2*Math.abs(p);
          A.set("eye",{s:[fl,fl,102,82]});
          A.filter(`drop-shadow(0 0 ${8+10*Math.abs(p)}px rgba(255,138,43,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 7. EXCHANGE BALLISTA ============
    const ballista = {
      kr:"거래소 발리스타", en:"Exchange Ballista", file:"assets/07-exchange-ballista.svg", vb:"0 0 190 205", walkLabel:"설치/대기",
      parts:["shadow","base1","base2","crown","banner","ballista","string","bolt"],
      markup:`
<g id="shadow"><ellipse cx="80" cy="191" rx="44" ry="6" fill="#000" opacity=".6"/></g>
<g id="base1">
  <path d="M44 188 L48 150 L112 150 L116 188 Z" fill="url(#gStone)"/>
  <path d="M44 188 L48 150 L60 150 L58 188 Z" fill="#000" opacity=".32"/>
  <path d="M104 150 L112 150 L116 188 L108 188 Z" fill="#C3CBD8" opacity=".22"/>
  <path d="M46 166 L114 166 M45 178 L115 178" stroke="#161A22" stroke-width="1.6" opacity=".55"/>
</g>
<g id="base2">
  <path d="M52 150 L54 106 L106 106 L108 150 Z" fill="url(#gStone)"/>
  <path d="M52 150 L54 106 L64 106 L62 150 Z" fill="#000" opacity=".32"/>
  <path d="M98 106 L106 106 L108 150 L100 150 Z" fill="#C3CBD8" opacity=".24"/>
  <path d="M53 122 L107 122 M53 136 L108 136" stroke="#161A22" stroke-width="1.5" opacity=".5"/>
</g>
<g id="crown">
  <path d="M48 106 L112 106 L112 94 L104 94 L104 99 L94 99 L94 94 L86 94 L86 99 L74 99 L74 94 L66 94 L66 99 L56 99 L56 94 L48 94 Z" fill="url(#gStone)"/>
  <path d="M48 106 L112 106 L112 102 L48 102 Z" fill="#161A22" opacity=".35"/>
  <path d="M50 94 L110 94 L110 88 L50 88 Z" fill="url(#gWood)"/>
</g>
<g id="banner">
  <path d="M36 110 L58 114 L56 150 L34 144 Z" fill="url(#gRed)"/>
  <path d="M36 110 L44 111.5 L42 146 L34 144 Z" fill="#000" opacity=".3"/>
  <rect x="40" y="134" width="3.2" height="9" fill="url(#gGold)"/>
  <rect x="45.5" y="128" width="3.2" height="13" fill="url(#gGold)"/>
  <rect x="51" y="122" width="3.2" height="16" fill="url(#gGold)"/>
</g>
<g id="ballista">
  <path d="M78 70 L106 58 L108 65 L82 77 Z" fill="url(#gWood)"/>
  <path d="M100 48 C 114 60, 114 88, 100 100" stroke="url(#gWood)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M100 48 C 111 60, 111 88, 100 100" stroke="#C79556" stroke-width="1.4" fill="none" opacity=".5"/>
  <g id="string">
    <line id="bs1" x1="100" y1="48" x2="76" y2="74" stroke="#D8D2C0" stroke-width="1.7"/>
    <line id="bs2" x1="100" y1="100" x2="76" y2="74" stroke="#D8D2C0" stroke-width="1.7"/>
  </g>
  <g id="bolt">
    <path d="M76 74 L 128 72" stroke="url(#gWood)" stroke-width="3.6"/>
    <path d="M128 72 L 142 74 L 128 77 Z" fill="#C0CAD8"/>
    <path d="M74 68 L83 74 L74 80 Z" fill="#B0442F"/>
  </g>
  <circle cx="76" cy="74" r="5" fill="url(#gGold)"/>
</g>`,
      notes:{
        walk:"설치 + 대기. 석조 베이스가 아래에서 위로 1단(base1) → 2단(base2) → 크레넬(crown) 순서로 시차를 두고 올라오고, 크림슨 배너가 scaleX로 펼쳐지며, 마지막에 발리스타 마운트가 안착합니다. 대기 중에는 배너만 미풍에 흔들립니다.",
        attack:"장전 → 발사 → 반동. 시위 노크점을 좌표로 (76,74)→(98,74)까지 스냅시켜 실제로 튕기고, 볼트가 노크에서 분리돼 +x로 날아가 소멸합니다. 마운트 전체가 허브(76,74)를 축으로 뒤로 9px 반동하며 배너가 발사풍에 밀립니다.",
        hit:"석조 전체가 진동. 상단 마운트가 하단보다 크게 흔들려 무게 차이가 읽히고, 배너가 크게 펄럭입니다.",
        death:"철거. 크레넬 → 2단 → 1단 순서로 무너지며 scaleY로 주저앉고, 발리스타가 앞으로 넘어지며 배너가 떨어집니다.",
        skill:"과충전 장전. 시위를 최대로 당겨 노크를 (70,74)까지 끌어당긴 상태로 유지하고, 황금 허브가 맥동합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        const nock=(x)=>{ A.attr("bs1","x2",x); A.attr("bs2","x2",x); };
        if(mo==="walk"){
          const b1=S(ph,0,.2), b2=S(ph,.14,.36), cr=S(ph,.3,.5), bl=S(ph,.44,.62), bn=S(ph,.56,.76);
          A.set("base1",{t:[0,44*(1-H.out(b1))],o:b1});
          A.set("base2",{t:[0,44*(1-H.out(b2))],o:b2});
          A.set("crown",{t:[0,30*(1-H.out(cr))],o:cr});
          A.set("ballista",{t:[0,24*(1-H.out(bl))],o:bl});
          A.set("banner",{s:[H.out(bn),1,36,110],o:bn});
          nock(76);
          if(ph>.8) A.set("banner",{k:[1.6*sin(PI2*ph*3),36,112]});
        } else if(mo==="attack"){
          nock(TR(ph,[[0,76],[.3,72],[.38,98],[.46,95],[.6,96],[1,76]],"out"));
          const fly=S(ph,.38,.8);
          A.set("bolt",{t:[fly*120,0],o: ph<.38?1:(1-Math.max(0,(fly-0.65)/0.35))});
          const rec=TR(ph,[[0,0],[.3,3],[.4,-9],[.62,-4],[1,0]],"out");
          A.set("ballista",{t:[rec,0],r:[TR(ph,[[0,0],[.4,-3],[1,0]],"out"),76,74]});
          A.set("crown",{t:[rec*0.35,0]});
          A.set("base2",{t:[rec*0.18,0]});
          A.set("banner",{k:[TR(ph,[[0,0],[.4,-9],[.7,4],[1,0]],"out"),36,112]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("ballista",{t:[-9*k,0],r:[-5*k,76,74]});
          A.set("crown",{t:[-6*k,0]});
          A.set("base2",{t:[-4*k,0],r:[-1.6*k,80,150]});
          A.set("base1",{t:[-2*k,0]});
          A.set("banner",{k:[16*k,36,112]});
          nock(76);
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const c1=H.inn(S(ph,.3,.72)), c2=H.inn(S(ph,.16,.6)), c3=H.inn(S(ph,.05,.46)), fade=S(ph,.72,1);
          nock(76);
          A.set("ballista",{t:[10*c3,26*c3],r:[46*c3,76,74],o:1-S(ph,.5,.9)});
          A.set("crown",{t:[-6*c3,18*c3],r:[-7*c3,80,106],s:[1,1-0.4*c3,80,106]});
          A.set("base2",{s:[1+0.08*c2,1-0.62*c2,80,150],k:[-3*c2,80,150]});
          A.set("base1",{s:[1+0.1*c1,1-0.5*c1,80,188],k:[2*c1,80,188]});
          A.set("banner",{t:[-8*c2,22*c2],r:[-34*c2,36,110],o:1-S(ph,.4,.8)});
          A.set("shadow",{s:[1+0.14*c1,1-0.5*fade,80,191]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*c1}) brightness(${1-0.3*c1})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          nock(H.lerp(76,70,r));
          A.set("ballista",{t:[-4*r,0]});
          A.set("banner",{k:[1.2*p,36,112]});
          A.filter(`drop-shadow(0 0 ${6+6*Math.abs(p)}px rgba(244,226,172,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 8. SHORT-SELL CANNON ============
    const cannon = {
      kr:"공매도 캐논", en:"Short-Sell Cannon", file:"assets/08-short-sell-cannon.svg", vb:"0 0 175 205", walkLabel:"설치/대기",
      parts:["shadow","base","emblem","body","barrel","hub"],
      markup:`
<g id="shadow"><ellipse cx="80" cy="191" rx="44" ry="6" fill="#000" opacity=".6"/></g>
<g id="base">
  <path d="M38 188 L44 148 L116 148 L122 188 Z" fill="url(#gStone)"/>
  <path d="M38 188 L44 148 L58 148 L54 188 Z" fill="#000" opacity=".32"/>
  <path d="M108 148 L116 148 L122 188 L112 188 Z" fill="#C3CBD8" opacity=".22"/>
  <path d="M40 164 L120 164 M39 176 L121 176" stroke="#161A22" stroke-width="1.6" opacity=".5"/>
</g>
<g id="emblem">
  <path d="M70 158 L90 158 L90 172 L70 172 Z" fill="#3A1218"/>
  <path d="M80 178 L72 164 L77 164 L77 154 L83 154 L83 164 L88 164 Z" fill="#D14A4A"/>
</g>
<g id="body">
  <path d="M52 148 L58 120 L102 120 L108 148 Z" fill="url(#gStone)"/>
  <path d="M52 148 L58 120 L68 120 L64 148 Z" fill="#000" opacity=".3"/>
  <path d="M96 120 L102 120 L108 148 L100 148 Z" fill="#C3CBD8" opacity=".2"/>
</g>
<g id="barrel">
  <g id="barrelIn" transform="rotate(-15 72 128)">
    <path d="M66 116 L128 112 L130 134 L66 140 Z" fill="url(#gBronze)"/>
    <path d="M66 118 L128 114 L128.6 120 L66.4 124 Z" fill="#F2D6A0" opacity=".45"/>
    <path d="M66 134 L128 129 L128.4 133 L66.3 138 Z" fill="#000" opacity=".35"/>
    <path d="M124 108 L134 107 L136 139 L124 138 Z" fill="url(#gBronze)"/>
    <ellipse cx="135" cy="123" rx="3.6" ry="15" fill="#1A1206"/>
    <path d="M84 112 L92 111.6 L93 140 L85 140 Z" fill="url(#gBronze)"/>
  </g>
</g>
<g id="hub">
  <circle cx="72" cy="128" r="13" fill="url(#gBronze)"/>
  <circle cx="72" cy="128" r="5" fill="#2A1D0C"/>
  <circle cx="69" cy="125" r="2.4" fill="#F2D6A0" opacity=".6"/>
</g>`,
      notes:{
        walk:"설치 + 대기. 무거운 석조 베이스가 위에서 지면으로 내리꽂히며 압축되고(scaleY 오버슈트), 청동 포신이 피벗 허브(72,128)를 축으로 -52°에서 정위치까지 들어올려집니다. 대기 중 포신이 아주 미세하게 호흡합니다.",
        attack:"발사 반동. 포신이 자기 축(-15° 방향)을 따라 정확히 후퇴합니다 — 축 성분(-cos15, +sin15)으로 분해해 16px 밀리므로 옆으로 어긋나지 않습니다. 베이스가 반동을 흡수해 진동하고 허브가 발열 발광합니다.",
        hit:"석조 벙커의 진동. 포신이 허브를 축으로 흔들리고 붉은 하락 화살표 문양이 흔들립니다.",
        death:"철거. 포신이 허브에서 빠져 앞으로 굴러떨어지고 벙커가 scaleY로 주저앉습니다.",
        skill:"조준 상향. 포신을 -12° 더 들어올려 곡사 각도를 잡고 허브가 맥동합니다."
      },
      anim:(ph,mo,A)=>{
        const AX=Math.cos(-15*Math.PI/180), AY=Math.sin(-15*Math.PI/180);
        if(mo==="walk"){
          const drop=S(ph,0,.26), squash=S(ph,.2,.34), settle=S(ph,.32,.46), rise=S(ph,.4,.72);
          const dy=52*(1-H.inn(drop));
          const sq=1-0.16*Math.sin(Math.PI*squash)+0.06*Math.sin(Math.PI*settle);
          A.set("base",{t:[0,dy],s:[1+0.1*Math.sin(Math.PI*squash),sq,80,188],o:Math.min(1,drop*3)});
          A.set("emblem",{t:[0,dy]});
          A.set("body",{t:[0,dy],s:[1,sq,80,148]});
          A.set("hub",{t:[0,dy]});
          A.set("barrel",{t:[0,dy],r:[-52*(1-H.out(rise)),72,128],o:Math.min(1,rise*4)});
        } else if(mo==="attack"){
          const rec=TR(ph,[[0,0],[.24,-2],[.34,16],[.62,7],[1,0]],"out");
          A.set("barrel",{t:[-rec*AX,-rec*AY]});
          const shake=TR(ph,[[0,0],[.34,1],[.5,.4],[.66,.15],[1,0]],"out");
          A.set("base",{t:[-3*shake,0],s:[1,1-0.02*shake,80,188]});
          A.set("body",{t:[-4*shake,0]});
          A.set("emblem",{t:[-3.5*shake,0]});
          A.set("hub",{t:[-4*shake,0],s:[1+0.08*shake,1+0.08*shake,72,128]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("barrel",{r:[-9*k,72,128],t:[-6*k,0]});
          A.set("body",{t:[-6*k,0],r:[-2*k,80,148]});
          A.set("base",{t:[-3*k,0]});
          A.set("emblem",{t:[-4*k,0],r:[3*k,80,166]});
          A.set("hub",{t:[-5*k,0]});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const roll=H.inn(S(ph,.08,.62)), col=H.inn(S(ph,.2,.75)), fade=S(ph,.72,1);
          A.set("barrel",{t:[26*roll,34*roll],r:[74*roll,72,128],o:1-S(ph,.5,.9)});
          A.set("hub",{t:[8*roll,10*roll],o:1-S(ph,.45,.85)});
          A.set("body",{s:[1+0.1*col,1-0.66*col,80,148],k:[-4*col,80,148]});
          A.set("base",{s:[1+0.12*col,1-0.46*col,80,188],k:[3*col,80,188]});
          A.set("emblem",{t:[0,14*col],o:1-S(ph,.4,.8)});
          A.set("shadow",{s:[1+0.14*col,1-0.5*fade,80,191]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*col}) brightness(${1-0.3*col})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("barrel",{r:[-12*r,72,128]});
          const hs=1+0.1*r+0.05*Math.abs(p);
          A.set("hub",{s:[hs,hs,72,128]});
          A.filter(`drop-shadow(0 0 ${6+6*Math.abs(p)}px rgba(226,78,27,${.35+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 9. OPTIONS SPIRE ============
    const spire = {
      kr:"옵션 첨탑", en:"Options Spire", file:"assets/09-options-spire.svg", vb:"0 0 170 205", walkLabel:"설치/대기",
      parts:["shadow","base","body","window","roof","orbGlow","orb","ring1","ring2","motes"],
      markup:`
<g id="shadow"><ellipse cx="80" cy="191" rx="40" ry="6" fill="#000" opacity=".6"/></g>
<g id="base">
  <path d="M50 188 L54 158 L106 158 L110 188 Z" fill="url(#gStone)"/>
  <path d="M50 188 L54 158 L64 158 L60 188 Z" fill="#000" opacity=".32"/>
  <path d="M52 174 L108 174" stroke="#161A22" stroke-width="1.6" opacity=".5"/>
</g>
<g id="body">
  <path d="M60 158 L62 84 L98 84 L100 158 Z" fill="url(#gStone)"/>
  <path d="M60 158 L62 84 L71 84 L69 158 Z" fill="#000" opacity=".33"/>
  <path d="M92 84 L98 84 L100 158 L94 158 Z" fill="#C3CBD8" opacity=".24"/>
  <path d="M61 104 L99 104 M61 124 L99 124 M60 144 L100 144" stroke="#161A22" stroke-width="1.4" opacity=".45"/>
</g>
<g id="window">
  <path d="M70 112 L90 112 L90 132 L70 132 Z" fill="#120E20"/>
  <path d="M74 118 L86 118 M74 126 L86 126" stroke="#8B6FD0" stroke-width="2" opacity=".8"/>
</g>
<g id="roof">
  <path d="M56 84 L104 84 L80 52 Z" fill="url(#gStone)"/>
  <path d="M56 84 L80 52 L80 84 Z" fill="#000" opacity=".3"/>
  <path d="M56 84 L104 84 L104 89 L56 89 Z" fill="url(#gSteelD)"/>
</g>
<g id="orbGlow"><g filter="url(#fSoft)"><circle cx="80" cy="30" r="18" fill="#7A5DB5" opacity=".55"/></g></g>
<g id="orb">
  <circle cx="80" cy="30" r="12" fill="url(#gViolet)"/>
  <circle cx="76" cy="26" r="4" fill="#E4D6FF" opacity=".8"/>
</g>
<g id="ring1"><ellipse cx="80" cy="30" rx="24" ry="7" fill="none" stroke="#B79CE8" stroke-width="1.8" opacity=".85"/></g>
<g id="ring2"><ellipse cx="80" cy="30" rx="24" ry="7" fill="none" stroke="#B79CE8" stroke-width="1.8" opacity=".45" transform="rotate(58 80 30)"/></g>
<g id="motes">
  <circle cx="104" cy="30" r="2.6" fill="#D9C7FF" filter="url(#fWarm)"/>
  <circle cx="61" cy="24" r="2" fill="#D9C7FF" filter="url(#fWarm)" opacity=".8"/>
</g>`,
      notes:{
        walk:"설치 + 대기. 첨탑이 지면에서 돌 하나씩 솟아오르고(base → body → roof 시차), 보라 오브가 빛 입자에서 scale로 응결되며, 룬 링 2개가 궤도로 스냅해 들어와 **서로 반대 방향으로 계속 반대 회전**합니다. 대기 중에도 링은 멈추지 않습니다.",
        attack:"룬 링 가속 → 사출. 링 회전 속도가 6배로 치솟아 모션블러처럼 뭉개지고, 오브가 1.5배로 부풀어 최대 충전된 뒤 아치형 창이 보라로 번쩍이며 방출됩니다. 방출 순간 오브가 급수축합니다.",
        hit:"첨탑이 흔들리고 링 궤도가 일시적으로 기울어집니다. 오브가 크게 진동하며 창의 빛이 깜빡입니다.",
        death:"만기 소멸. 오브가 꺼지며 축소되고 링이 궤도를 잃고 흩어지며, 첨탑이 무너집니다.",
        skill:"콜/풋 전환 대기. 오브를 최대 충전 상태로 유지하고 두 링이 서로 다른 속도로 맥동 회전합니다."
      },
      anim:(ph,mo,A)=>{
        const p=sin(PI2*ph);
        if(mo==="walk"){
          const b=S(ph,0,.24), bd=S(ph,.16,.44), rf=S(ph,.36,.56), ob=S(ph,.5,.72), rg=S(ph,.62,.84);
          A.set("base",{t:[0,36*(1-H.out(b))],o:b});
          A.set("body",{t:[0,60*(1-H.out(bd))],o:bd});
          A.set("roof",{t:[0,40*(1-H.out(rf))],o:rf});
          A.set("window",{t:[0,60*(1-H.out(bd))],o:bd*(0.5+0.5*Math.abs(p))});
          const os=H.out(ob);
          A.set("orb",{s:[os,os,80,30],o:ob});
          A.set("orbGlow",{s:[os,os,80,30],o:ob*0.9});
          A.set("ring1",{r:[ph*300*H.out(rg),80,30],o:rg});
          A.set("ring2",{r:[-ph*300*H.out(rg),80,30],o:rg*0.6});
          A.set("motes",{r:[ph*200,80,30],o:rg});
        } else if(mo==="attack"){
          const spin=ph*1600, chg=TR(ph,[[0,1],[.28,1.2],[.5,1.5],[.56,1.55],[.62,0.55],[.78,1],[1,1]],"out");
          A.set("ring1",{r:[spin,80,30],s:[1+0.1*Math.sin(PI2*ph*4),1+0.5*Math.abs(Math.sin(PI2*ph*4)),80,30]});
          A.set("ring2",{r:[-spin,80,30],s:[1+0.1*Math.cos(PI2*ph*4),1+0.5*Math.abs(Math.cos(PI2*ph*4)),80,30]});
          A.set("orb",{s:[chg,chg,80,30]});
          A.set("orbGlow",{s:[chg*1.1,chg*1.1,80,30],o:0.5+0.5*Math.min(1,chg)});
          const flare=TR(ph,[[0,.5],[.5,1],[.6,2.2],[.72,.7],[1,.5]],"out");
          A.set("window",{o:Math.min(1,flare)});
          A.set("body",{t:[TR(ph,[[0,0],[.6,-3],[.75,1],[1,0]],"out"),0]});
          A.set("motes",{r:[spin*0.4,80,30]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("base",{t:[-2*k,0]});
          A.set("body",{t:[-7*k,0],r:[-2.4*k,80,158]});
          A.set("window",{t:[-7*k,0],o:0.4+0.6*(1-k)});
          A.set("roof",{t:[-9*k,0],r:[-4*k,80,84]});
          A.set("orb",{t:[-13*k,-4*k]});
          A.set("orbGlow",{t:[-13*k,-4*k]});
          A.set("ring1",{r:[ph*300,80,30],s:[1,1+0.8*k,80,30],t:[-11*k,0]});
          A.set("ring2",{r:[-ph*300,80,30],s:[1,1+0.8*k,80,30],t:[-11*k,0]});
          A.set("motes",{t:[-12*k,0]});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const die=H.inn(S(ph,.06,.6)), col=H.inn(S(ph,.24,.78)), fade=S(ph,.72,1);
          A.set("orb",{s:[Math.max(0.04,1-1.05*die),Math.max(0.04,1-1.05*die),80,30],o:Math.max(0,1-1.2*die)});
          A.set("orbGlow",{s:[Math.max(0.04,1-die),Math.max(0.04,1-die),80,30],o:Math.max(0,0.9-1.3*die)});
          A.set("ring1",{r:[ph*180,80,30],s:[1+1.1*die,1+2.2*die,80,30],o:Math.max(0,0.85-1.2*die)});
          A.set("ring2",{r:[-ph*180,80,30],s:[1+1.4*die,1+2.6*die,80,30],o:Math.max(0,0.45-1.1*die)});
          A.set("motes",{t:[0,-24*die],o:Math.max(0,1-1.4*die)});
          A.set("roof",{t:[-8*col,20*col],r:[-16*col,80,84],o:1-S(ph,.5,.9)});
          A.set("window",{o:Math.max(0,1-1.6*die)});
          A.set("body",{s:[1+0.1*col,1-0.7*col,80,158],k:[-5*col,80,158]});
          A.set("base",{s:[1+0.1*col,1-0.44*col,80,188],k:[3*col,80,188]});
          A.set("shadow",{s:[1+0.12*col,1-0.5*fade,80,191]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*col}) brightness(${1-0.3*col})`);
        } else {
          const r=S(ph,0,.3);
          const chg=1+0.45*r+0.12*Math.abs(p);
          A.set("orb",{s:[chg,chg,80,30]});
          A.set("orbGlow",{s:[chg*1.15,chg*1.15,80,30],o:0.55+0.4*Math.abs(p)});
          A.set("ring1",{r:[ph*620,80,30]});
          A.set("ring2",{r:[-ph*380,80,30]});
          A.set("window",{o:0.5+0.5*Math.abs(p)});
          A.set("motes",{r:[ph*240,80,30]});
          A.filter(`drop-shadow(0 0 ${8+8*Math.abs(p)}px rgba(183,156,232,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 10. CIRCUIT BREAKER ============
    const breaker = {
      kr:"서킷브레이커", en:"Circuit Breaker", file:"assets/10-circuit-breaker.svg", vb:"0 0 170 205", walkLabel:"설치/대기",
      parts:["shadow","aura","base","panel","lamp","lever","crysMid","crysTall","crysShort","flakes"],
      markup:`
<g id="shadow"><ellipse cx="80" cy="191" rx="42" ry="6" fill="#000" opacity=".6"/></g>
<g id="aura"><g filter="url(#fSoft)"><ellipse cx="80" cy="150" rx="46" ry="30" fill="#96D8EC" opacity=".22"/></g></g>
<g id="base">
  <path d="M44 188 L50 152 L110 152 L116 188 Z" fill="url(#gStone)"/>
  <path d="M44 188 L50 152 L62 152 L58 188 Z" fill="#000" opacity=".32"/>
  <path d="M104 152 L110 152 L116 188 L108 188 Z" fill="#C3CBD8" opacity=".22"/>
  <path d="M46 170 L114 170" stroke="#161A22" stroke-width="1.6" opacity=".5"/>
</g>
<g id="panel"><path d="M66 158 L94 158 L94 180 L66 180 Z" fill="#161A22"/></g>
<g id="lamp"><circle cx="80" cy="164" r="5" fill="#D14A4A" filter="url(#fWarm)"/></g>
<g id="lever"><path d="M80 168 L80 178" stroke="#8A9099" stroke-width="4" stroke-linecap="round"/></g>
<g id="crysMid">
  <path d="M62 152 L74 96 L86 152 Z" fill="url(#gIce)"/>
  <path d="M62 152 L74 96 L76 152 Z" fill="#fff" opacity=".28"/>
  <path d="M74 96 L79 108 L74 114 L69 108 Z" fill="#EAFBFF" opacity=".55"/>
</g>
<g id="crysTall">
  <path d="M84 152 L98 66 L112 152 Z" fill="url(#gIce)"/>
  <path d="M84 152 L98 66 L100 152 Z" fill="#fff" opacity=".3"/>
  <path d="M98 66 L104 82 L98 88 L92 82 Z" fill="#EAFBFF" opacity=".6"/>
</g>
<g id="crysShort">
  <path d="M50 152 L60 112 L70 152 Z" fill="url(#gIce)"/>
  <path d="M50 152 L60 112 L61 152 Z" fill="#fff" opacity=".26"/>
</g>
<g id="flakes">
  <g filter="url(#fWarm)">
    <path d="M118 100 L124 106 L118 112 L112 106 Z" fill="#C9F0FF" opacity=".8"/>
    <path d="M40 122 L45 127 L40 132 L35 127 Z" fill="#C9F0FF" opacity=".7"/>
    <path d="M112 138 L116 142 L112 146 L108 142 Z" fill="#C9F0FF" opacity=".6"/>
  </g>
</g>`,
      notes:{
        walk:"설치 + 대기. 석조 베이스가 안착한 뒤 얼음 결정 3개가 **각자 다른 타이밍으로** 지면을 뚫고 솟아오릅니다(짧은 것 → 중간 → 긴 것). 붉은 경고등이 처음 점등하며 깜빡이고, 서리 아우라가 링으로 퍼집니다. 대기 중 결정이 미세하게 맥동합니다.",
        attack:"발동 (투사체 없음). 금속 정지 레버가 상단 축(80,168)을 기준으로 **78° 완전히 내려꽂히고**, 그 프레임에 붉은 경고등이 최대로 폭발하며 얼음 결정 3개가 동시에 백청색으로 번쩍입니다. 서리 아우라가 충격파로 확장됩니다.",
        hit:"결정이 흔들리며 서로 다른 위상으로 진동합니다. 경고등이 깜빡이고 눈송이가 튀어오릅니다.",
        death:"결정이 산산이 깨져 각기 다른 방향으로 흩어지며 녹아 사라지고, 경고등이 꺼진 뒤 베이스가 주저앉습니다.",
        skill:"과열 정지. 레버를 내린 상태로 유지하고 결정 전체가 동시에 맥동, 아우라가 최대 반경으로 확장 유지됩니다."
      },
      anim:(ph,mo,A)=>{
        const p=sin(PI2*ph);
        if(mo==="walk"){
          const b=S(ph,0,.22), c1=S(ph,.18,.4), c2=S(ph,.28,.5), c3=S(ph,.38,.6), lp=S(ph,.56,.7), au=S(ph,.6,.9);
          A.set("base",{t:[0,40*(1-H.out(b))],o:b});
          A.set("panel",{t:[0,40*(1-H.out(b))],o:b});
          A.set("lever",{t:[0,40*(1-H.out(b))],o:b});
          A.set("lamp",{t:[0,40*(1-H.out(b))],o:lp>0?(0.4+0.6*Math.abs(sin(PI2*ph*6))):0.1,s:[0.8+0.4*lp,0.8+0.4*lp,80,164]});
          const g=(k)=>[1,H.out(k),0,152];
          A.set("crysShort",{s:[1,Math.max(0.02,H.out(c1)),60,152],o:c1});
          A.set("crysMid",{s:[1,Math.max(0.02,H.out(c2)),74,152],o:c2});
          A.set("crysTall",{s:[1,Math.max(0.02,H.out(c3)),98,152],o:c3});
          A.set("aura",{s:[H.out(au),H.out(au),80,150],o:au*0.9});
          A.set("flakes",{t:[0,-6*au],o:au});
        } else if(mo==="attack"){
          const lv=TR(ph,[[0,0],[.2,-10],[.34,78],[.6,78],[.82,0],[1,0]],"out");
          A.set("lever",{r:[lv,80,168]});
          const fire=TR(ph,[[0,.35],[.32,.4],[.36,1],[.55,.6],[.8,.35],[1,.35]],"out");
          A.set("lamp",{s:[1+1.5*fire,1+1.5*fire,80,164],o:0.4+0.6*fire});
          const fl=TR(ph,[[0,0],[.34,0],[.38,1],[.6,.25],[1,0]],"out");
          const cs=1+0.05*fl;
          A.set("crysMid",{s:[cs,cs,74,152]});
          A.set("crysTall",{s:[cs,cs,98,152]});
          A.set("crysShort",{s:[cs,cs,60,152]});
          const shock=TR(ph,[[0,1],[.36,1],[.6,1.5],[1,1]],"out");
          A.set("aura",{s:[shock,shock*0.8,80,150],o:0.5+0.5*fl});
          A.set("flakes",{t:[0,-14*fl],s:[1+0.3*fl,1+0.3*fl,80,120],o:0.6+0.4*fl});
          A.set("panel",{t:[0,1.5*fl]});
          A.filter(`brightness(${1+0.35*fl})`);
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("base",{t:[-3*k,0]});
          A.set("panel",{t:[-4*k,0]});
          A.set("lever",{t:[-4*k,0],r:[-14*k,80,168]});
          A.set("lamp",{t:[-4*k,0],o:0.3+0.7*Math.abs(sin(PI2*ph*8))});
          A.set("crysMid",{r:[-6*k,74,152],t:[-5*k,0]});
          A.set("crysTall",{r:[-8*sin(PI2*ph*3)*k,98,152],t:[-6*k,0]});
          A.set("crysShort",{r:[7*k,60,152],t:[-4*k,0]});
          A.set("flakes",{t:[-8*k,-8*k]});
          A.set("aura",{o:0.5});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const sh=H.inn(S(ph,.06,.58)), col=H.inn(S(ph,.28,.8)), fade=S(ph,.68,1);
          A.set("crysTall",{t:[22*sh,-14*sh],r:[54*sh,98,152],o:Math.max(0,1-1.5*sh)});
          A.set("crysMid",{t:[-6*sh,-20*sh],r:[-36*sh,74,152],o:Math.max(0,1-1.5*sh)});
          A.set("crysShort",{t:[-26*sh,-8*sh],r:[-70*sh,60,152],o:Math.max(0,1-1.5*sh)});
          A.set("flakes",{t:[0,-30*sh],s:[1+0.6*sh,1+0.6*sh,80,120],o:Math.max(0,0.8-1.3*sh)});
          A.set("aura",{s:[1-0.5*sh,1-0.6*sh,80,150],o:Math.max(0,0.9-1.5*sh)});
          A.set("lamp",{o:Math.max(0,1-2*sh)});
          A.set("lever",{r:[64*col,80,168]});
          A.set("panel",{t:[0,10*col],o:1-S(ph,.5,.9)});
          A.set("base",{s:[1+0.12*col,1-0.5*col,80,188],k:[3*col,80,188]});
          A.set("shadow",{s:[1+0.12*col,1-0.5*fade,80,191]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.7*col}) brightness(${1-0.3*col})`);
        } else {
          const r=S(ph,0,.3);
          A.set("lever",{r:[74*r,80,168]});
          A.set("lamp",{s:[1+0.7*r,1+0.7*r,80,164],o:0.5+0.5*Math.abs(p)});
          const cs=1+0.04*r+0.02*Math.abs(p);
          A.set("crysMid",{s:[cs,cs,74,152]});
          A.set("crysTall",{s:[cs,cs,98,152]});
          A.set("crysShort",{s:[cs,cs,60,152]});
          A.set("aura",{s:[1+0.45*r+0.1*Math.abs(p),1+0.3*r,80,150],o:0.6+0.4*Math.abs(p)});
          A.set("flakes",{t:[0,-10*r-4*Math.abs(p)]});
          A.filter(`drop-shadow(0 0 ${8+8*Math.abs(p)}px rgba(150,216,236,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 11. COMPOUND FLAME ============
    const flame = {
      kr:"복리 화염탑", en:"Compound Flame", file:"assets/11-compound-flame.svg", vb:"0 0 190 205", walkLabel:"설치/대기",
      parts:["shadow","base","body","bars","head","pilot","mouth","jetGlow","jet","embers"],
      markup:`
<g id="shadow"><ellipse cx="76" cy="191" rx="42" ry="6" fill="#000" opacity=".6"/></g>
<g id="base">
  <path d="M40 188 L46 146 L106 146 L112 188 Z" fill="url(#gStone)"/>
  <path d="M40 188 L46 146 L58 146 L54 188 Z" fill="#000" opacity=".32"/>
  <path d="M100 146 L106 146 L112 188 L104 188 Z" fill="#C3CBD8" opacity=".22"/>
  <path d="M42 164 L110 164 M41 176 L111 176" stroke="#161A22" stroke-width="1.6" opacity=".5"/>
</g>
<g id="bars"><path d="M50 138 L54 138 L54 130 L50 130 Z M57 138 L61 138 L61 124 L57 124 Z M64 138 L68 138 L68 116 L64 116 Z" fill="url(#gGold)" opacity=".9"/></g>
<g id="body">
  <path d="M52 146 L58 112 L98 112 L104 146 Z" fill="url(#gStone)"/>
  <path d="M52 146 L58 112 L68 112 L62 146 Z" fill="#000" opacity=".3"/>
</g>
<g id="head">
  <path d="M56 112 C 56 88, 78 76, 96 84 C 112 92, 116 104, 114 112 C 108 100, 96 94, 86 96 L 88 108 L 72 108 L 68 96 C 62 100, 58 106, 56 112 Z" fill="url(#gStone)"/>
  <path d="M56 112 C 56 92, 72 80, 88 82 C 74 84, 62 94, 59 112 Z" fill="#C3CBD8" opacity=".25"/>
  <path d="M96 84 C 112 92, 116 104, 114 112 L 106 110 C 106 100, 102 92, 92 86 Z" fill="#000" opacity=".3"/>
  <g id="pilot"><circle cx="92" cy="94" r="4" fill="#FFB347" filter="url(#fWarm)"/></g>
  <g id="mouth"><path d="M86 96 L 100 92 L 112 96 L 104 104 L 92 104 Z" fill="#2A1D0C"/></g>
</g>
<g id="jetGlow"><g filter="url(#fSoft)"><path d="M104 100 C 124 88, 148 92, 158 100 C 146 104, 132 108, 118 112 C 128 104, 118 98, 104 100 Z" fill="#FF8A2B" opacity=".65"/></g></g>
<g id="jet"><path d="M104 100 C 122 90, 142 94, 152 100 C 140 104, 126 106, 114 108 C 122 102, 114 98, 104 100 Z" fill="url(#gFlame)"/></g>
<g id="embers">
  <circle cx="146" cy="90" r="3" fill="#FFC061" filter="url(#fWarm)" opacity=".9"/>
  <circle cx="132" cy="82" r="2" fill="#FFC061" filter="url(#fWarm)" opacity=".7"/>
  <circle cx="152" cy="112" r="2.4" fill="#FF8A2B" filter="url(#fWarm)" opacity=".7"/>
</g>`,
      notes:{
        walk:"설치 + 대기. 석조 블록이 base → body 순으로 쌓이고 마지막에 용머리 조각이 위에서 내려앉습니다. 안착 프레임에 입안 파일럿 불꽃이 처음 점화되며(scale 0→1), 대기 중에는 분사 없이 파일럿 불꽃만 깜빡이고 열기가 아른거립니다.",
        attack:"지속 화염 분사. 제트가 분사구(104,100)를 원점으로 scaleX 1.0→1.45로 뻗어나가고, scaleY 난류 흔들림이 겹쳐 흐름이 살아 있게 보입니다. 용머리가 반동으로 살짝 젖혀지고 잉걸불이 제트 끝에서 흘러 올라갑니다.",
        hit:"석조가 진동하고 화염 분사가 순간 끊겼다 회복됩니다. 용머리가 흔들립니다.",
        death:"화염이 꺼져 축소되고 용머리가 조각째 앞으로 떨어져 나가며, 탑이 주저앉습니다. 황금 막대 차트가 마지막에 꺼집니다.",
        skill:"복리 스택 최대. 제트를 1.6배까지 뻗어 유지하며 주황 → 백열로 색이 상승하고, 황금 막대 3개가 순차 점등합니다."
      },
      anim:(ph,mo,A)=>{
        const p=sin(PI2*ph), turb=sin(PI2*ph*7);
        if(mo==="walk"){
          const b=S(ph,0,.22), bd=S(ph,.18,.42), hd=S(ph,.4,.62), ig=S(ph,.6,.72);
          A.set("base",{t:[0,40*(1-H.out(b))],o:b});
          A.set("bars",{t:[0,40*(1-H.out(b))],o:b*0.9});
          A.set("body",{t:[0,34*(1-H.out(bd))],o:bd});
          A.set("head",{t:[0,-46*(1-H.out(hd))],o:hd});
          const ps=H.out(ig)*(0.7+0.3*Math.abs(sin(PI2*ph*5)));
          A.set("pilot",{s:[ps,ps,92,94],o:ig});
          A.set("jet",{s:[0.001,0.001,104,100],o:0});
          A.set("jetGlow",{s:[0.001,0.001,104,100],o:0});
          A.set("embers",{o:ig*0.4,t:[-10,-4*p]});
        } else if(mo==="attack"){
          const ex=TR(ph,[[0,1],[.18,1.3],[.5,1.45],[.8,1.38],[1,1]],"out");
          A.set("jet",{s:[ex,1+0.12*turb,104,100],o:1});
          A.set("jetGlow",{s:[ex*1.05,1+0.16*turb,104,100],o:0.75});
          const ps=1.5+0.25*Math.abs(turb);
          A.set("pilot",{s:[ps,ps,92,94],o:1});
          A.set("head",{r:[TR(ph,[[0,0],[.2,-3.5],[.6,-2.6],[1,0]],"out"),70,112],t:[TR(ph,[[0,0],[.2,-2.5],[1,0]],"out"),0]});
          A.set("embers",{t:[8+10*((ph*2)%1),-8-14*((ph*2)%1)],o:0.9*(1-((ph*2)%1))});
          A.set("bars",{o:0.9});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("base",{t:[-3*k,0]});
          A.set("body",{t:[-5*k,0],r:[-1.8*k,76,146]});
          A.set("bars",{t:[-3*k,0]});
          A.set("head",{t:[-9*k,0],r:[-8*k,70,112]});
          A.set("pilot",{s:[1-0.5*k,1-0.5*k,92,94]});
          A.set("jet",{s:[Math.max(0.05,1.3-1.2*k),1-0.4*k,104,100],o:1-0.7*k});
          A.set("jetGlow",{s:[Math.max(0.05,1.3-1.2*k),1,104,100],o:0.7-0.5*k});
          A.set("embers",{t:[-6*k,0],o:0.5});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const out=H.inn(S(ph,.05,.5)), fallH=H.inn(S(ph,.2,.7)), col=H.inn(S(ph,.3,.82)), fade=S(ph,.74,1);
          A.set("jet",{s:[Math.max(0.02,1-1.1*out),Math.max(0.02,1-out),104,100],o:Math.max(0,1-1.3*out)});
          A.set("jetGlow",{s:[Math.max(0.02,1-out),Math.max(0.02,1-out),104,100],o:Math.max(0,0.7-1.2*out)});
          A.set("pilot",{s:[Math.max(0.02,1-1.2*out),Math.max(0.02,1-1.2*out),92,94],o:Math.max(0,1-1.4*out)});
          A.set("embers",{t:[0,-24*out],o:Math.max(0,0.8-1.4*out)});
          A.set("head",{t:[24*fallH,32*fallH],r:[68*fallH,70,112],o:1-S(ph,.55,.92)});
          A.set("body",{s:[1+0.1*col,1-0.66*col,76,146],k:[-4*col,76,146]});
          A.set("base",{s:[1+0.12*col,1-0.46*col,76,188],k:[3*col,76,188]});
          A.set("bars",{o:Math.max(0,0.9-1.5*col)});
          A.set("shadow",{s:[1+0.14*col,1-0.5*fade,76,191]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*col}) brightness(${1-0.3*col})`);
        } else {
          const r=S(ph,0,.3);
          const ex=1+0.6*r;
          A.set("jet",{s:[ex,1+0.14*turb,104,100],o:1});
          A.set("jetGlow",{s:[ex*1.08,1+0.18*turb,104,100],o:0.8});
          A.set("pilot",{s:[1.8,1.8,92,94]});
          A.set("head",{r:[-3*r,70,112]});
          A.set("embers",{t:[10*r,-10-8*Math.abs(p)],o:1});
          A.set("bars",{o:0.5+0.5*Math.abs(p)});
          A.filter(`drop-shadow(0 0 ${8+10*Math.abs(p)}px rgba(255,138,43,${.45+.35*Math.abs(p)})) brightness(${1+0.25*r})`);
        }
      }
    };

    // ============ 12. CENTRAL BANK VAULT ============
    const vault = {
      kr:"중앙은행 금고", en:"Central Bank Vault", file:"assets/12-central-bank-vault.svg", vb:"0 0 175 205", walkLabel:"설치/대기",
      parts:["shadow","glow","base","building","pediment","trim","doorFrame","door","coins","pennant","sparks"],
      markup:`
<g id="shadow"><ellipse cx="80" cy="191" rx="44" ry="6" fill="#000" opacity=".6"/></g>
<g id="glow"><g filter="url(#fSoft)"><ellipse cx="80" cy="140" rx="44" ry="30" fill="#FFE9A8" opacity=".18"/></g></g>
<g id="base">
  <path d="M40 188 L44 156 L116 156 L120 188 Z" fill="url(#gStone)"/>
  <path d="M40 188 L44 156 L56 156 L52 188 Z" fill="#000" opacity=".32"/>
  <path d="M42 174 L118 174" stroke="#161A22" stroke-width="1.6" opacity=".5"/>
</g>
<g id="building">
  <path d="M48 156 L50 96 L110 96 L112 156 Z" fill="url(#gStone)"/>
  <path d="M48 156 L50 96 L60 96 L58 156 Z" fill="#000" opacity=".32"/>
  <path d="M102 96 L110 96 L112 156 L104 156 Z" fill="#C3CBD8" opacity=".24"/>
</g>
<g id="pediment">
  <path d="M42 96 L118 96 L80 62 Z" fill="url(#gStone)"/>
  <path d="M42 96 L80 62 L80 96 Z" fill="#000" opacity=".28"/>
</g>
<g id="trim"><path d="M42 96 L118 96 L118 102 L42 102 Z" fill="url(#gGold)"/></g>
<g id="doorFrame"><circle cx="80" cy="132" r="24" fill="url(#gSteelD)"/></g>
<g id="door">
  <circle cx="80" cy="132" r="19" fill="url(#gGold)"/>
  <circle cx="80" cy="132" r="14" fill="#8A6A28"/>
  <circle cx="80" cy="132" r="6" fill="url(#gGold)"/>
  <path d="M80 118 L80 146 M66 132 L94 132 M70 122 L90 142 M90 122 L70 142" stroke="#5C4517" stroke-width="2.4"/>
  <circle cx="74" cy="126" r="3" fill="#FFF0C4" opacity=".55"/>
</g>
<g id="coins">
  <ellipse cx="52" cy="176" rx="9" ry="4" fill="url(#gGold)"/>
  <ellipse cx="60" cy="172" rx="7" ry="3.4" fill="url(#gGold)"/>
  <ellipse cx="108" cy="177" rx="8" ry="3.6" fill="url(#gGold)"/>
</g>
<g id="pennant">
  <path d="M118 66 L140 72 L118 78 Z" fill="url(#gRed)"/>
  <path d="M118 60 L118 96" stroke="#8A9099" stroke-width="3"/>
</g>
<g id="sparks">
  <circle cx="46" cy="150" r="3" fill="#FFE9A8" filter="url(#fWarm)" opacity=".9"/>
  <circle cx="118" cy="138" r="2.4" fill="#FFE9A8" filter="url(#fWarm)" opacity=".8"/>
</g>`,
      notes:{
        walk:"설치 + 대기. 석벽이 올라와 안착하고 삼각 페디먼트가 내려앉은 뒤, 거대 황금 금고 문이 **-150°에서 회전해 닫히며 봉인**됩니다(테두리에 봉인 섬광). 크림슨 페넌트가 펼쳐지고 첫 금화가 아래로 굴러 나옵니다.",
        attack:"배당 지급. 금고 문이 축(80,132)을 중심으로 **+200° 회전해 열리고**, 내부 광량이 폭발적으로 증가하며 금화가 아래로 쏟아져 지면을 튕깁니다. 회전은 스포크가 실제로 돌아가는 것으로 읽힙니다.",
        hit:"석조 건물이 진동하고 금고 문이 축에서 덜컹거립니다. 쌓인 금화가 튀고 페넌트가 펄럭입니다.",
        death:"철거. 금고 문이 축에서 빠져 앞으로 굴러 떨어지고, 금화가 흩어지며 건물이 주저앉습니다.",
        skill:"골드 흡수. 문을 반쯤 열어 유지하고 금화가 위로 빨려 올라가며, 따뜻한 황금 글로우가 최대로 맥동합니다."
      },
      anim:(ph,mo,A)=>{
        const p=sin(PI2*ph);
        if(mo==="walk"){
          const b=S(ph,0,.2), bd=S(ph,.14,.4), pd=S(ph,.34,.54), dr=S(ph,.5,.74), seal=S(ph,.72,.82), pn=S(ph,.76,.94);
          A.set("base",{t:[0,36*(1-H.out(b))],o:b});
          A.set("building",{t:[0,58*(1-H.out(bd))],o:bd});
          A.set("pediment",{t:[0,-40*(1-H.out(pd))],o:pd});
          A.set("trim",{t:[0,-40*(1-H.out(pd))],o:pd});
          A.set("doorFrame",{o:dr,s:[H.out(dr),H.out(dr),80,132]});
          A.set("door",{o:dr,r:[-150*(1-H.out(dr)),80,132],s:[H.out(dr),H.out(dr),80,132]});
          A.set("pennant",{s:[H.out(pn),1,118,66],o:pn});
          A.set("coins",{o:S(ph,.8,.95),t:[0,6*(1-S(ph,.8,.95))]});
          A.set("glow",{o:0.18+0.5*Math.sin(Math.PI*seal)});
          A.set("sparks",{o:pn*0.9});
        } else if(mo==="attack"){
          const open=TR(ph,[[0,0],[.24,-14],[.6,200],[.78,200],[1,0]],"out");
          A.set("door",{r:[open,80,132]});
          const light=TR(ph,[[0,.2],[.3,.4],[.6,1],[.8,.7],[1,.2]],"out");
          A.set("glow",{o:0.18+0.7*light,s:[1+0.35*light,1+0.35*light,80,140]});
          const pour=(ph*2)%1;
          A.set("coins",{t:[10*pour,-4+18*pour],o:1-pour*0.6,s:[1+0.2*pour,1+0.2*pour,80,176]});
          A.set("sparks",{t:[0,-16*light],o:0.5+0.5*light});
          A.set("pennant",{k:[TR(ph,[[0,0],[.6,-8],[.85,3],[1,0]],"out"),118,70]});
          A.set("building",{t:[TR(ph,[[0,0],[.6,-2],[1,0]],"out"),0]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("base",{t:[-3*k,0]});
          A.set("building",{t:[-6*k,0],r:[-1.8*k,80,156]});
          A.set("pediment",{t:[-8*k,0],r:[-3*k,80,96]});
          A.set("trim",{t:[-8*k,0]});
          A.set("doorFrame",{t:[-6*k,0]});
          A.set("door",{t:[-6*k,0],r:[-16*k,80,132]});
          A.set("coins",{t:[-6*k,-5*k],s:[1+0.1*k,1+0.1*k,80,176]});
          A.set("pennant",{k:[18*k,118,70]});
          A.set("sparks",{t:[-6*k,-6*k]});
          A.set("glow",{o:0.5});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const roll=H.inn(S(ph,.06,.6)), col=H.inn(S(ph,.26,.8)), fade=S(ph,.72,1);
          A.set("door",{t:[30*roll,36*roll],r:[300*roll,80,132],o:1-S(ph,.5,.9)});
          A.set("doorFrame",{o:Math.max(0,1-1.6*roll)});
          A.set("coins",{t:[-14*roll,6*roll],s:[1+0.4*roll,1-0.3*roll,80,176],o:Math.max(0,1-1.4*roll)});
          A.set("pediment",{t:[-10*col,22*col],r:[-14*col,80,96],o:1-S(ph,.5,.9)});
          A.set("trim",{t:[-10*col,22*col],o:1-S(ph,.5,.9)});
          A.set("pennant",{t:[8*col,26*col],r:[46*col,118,66],o:1-S(ph,.4,.8)});
          A.set("building",{s:[1+0.1*col,1-0.66*col,80,156],k:[-4*col,80,156]});
          A.set("base",{s:[1+0.12*col,1-0.46*col,80,188],k:[3*col,80,188]});
          A.set("glow",{o:Math.max(0,0.18-0.3*col)});
          A.set("sparks",{o:Math.max(0,0.9-1.6*col)});
          A.set("shadow",{s:[1+0.14*col,1-0.5*fade,80,191]});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*col}) brightness(${1-0.3*col})`);
        } else {
          const r=S(ph,0,.3), up=(ph*1.6)%1;
          A.set("door",{r:[96*r,80,132]});
          A.set("glow",{o:0.18+0.6*(r*(0.6+0.4*Math.abs(p))),s:[1+0.3*r,1+0.3*r,80,140]});
          A.set("coins",{t:[0,-40*up*r],o:1-up*r,s:[1-0.3*up*r,1-0.3*up*r,80,176]});
          A.set("sparks",{t:[0,-14*r-4*Math.abs(p)],o:0.6+0.4*Math.abs(p)});
          A.filter(`drop-shadow(0 0 ${8+9*Math.abs(p)}px rgba(255,233,168,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 13. PANIC-SELL DRONE ============
    const drone = {
      kr:"패닉셀 드론", en:"Panic-Sell Drone", file:"assets/13-panic-sell-drone.svg", vb:"0 40 175 165", walkLabel:"비행",
      parts:["glow","chassis","eye","fin","clawBack","clawFront","core"],
      markup:`
<g id="glow"><ellipse cx="80" cy="178" rx="26" ry="4" fill="#2DE2E6" opacity=".2" filter="url(#nGlowBig)"/></g>
<g id="chassis">
  <path d="M52 84 L96 72 L118 92 L114 122 L74 134 L50 116 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M96 72 L118 92 L114 122 L104 125 L110 94 Z" fill="#4A5F82" opacity=".4"/>
</g>
<g id="eye">
  <path d="M50 100 L74 92 L78 110 L54 118 Z" fill="#050A11" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M54 102 L72 96 L75 108 L57 114 Z" fill="#2DE2E6" filter="url(#nGlow)"/>
  <ellipse cx="62" cy="104" rx="5" ry="2.6" fill="#EEFEFF" opacity=".85"/>
</g>
<g id="fin"><path d="M100 78 L116 66 L122 72 L108 84 Z" fill="#1B2436" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/></g>
<g id="clawBack">
  <path d="M86 132 L104 128 L100 148 L88 150 Z" fill="#141C2A" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M90 148 L100 146 L98 158 L92 159 Z" fill="#2DE2E6" opacity=".6" filter="url(#nGlow)"/>
</g>
<g id="clawFront">
  <path d="M64 130 L80 126 L78 146 L66 148 Z" fill="#141C2A" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M68 146 L78 144 L76 156 L70 157 Z" fill="#2DE2E6" opacity=".6" filter="url(#nGlow)"/>
</g>
<g id="core">
  <path d="M92 96 L108 92 L110 108 L94 112 Z" fill="#080D16" stroke="#FF3CAC" stroke-width="2.4"/>
  <path d="M98 98 L105 96.5 L106 106 L99 107.5 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/>
</g>`,
      notes:{
        walk:"비행 루프. 다리가 없으므로 부유 진동(6프레임)만으로 이동합니다. 기체가 진행 방향(-x)으로 살짝 기울고, 집게 두 개가 관성으로 각자 다른 위상으로 늘어지며, 시안 스러스터 글로우가 부유 최저점에서 가장 밝게 맥동합니다.",
        attack:"돌진 집게. 기체가 -x로 16px 파고들며 코를 아래로 처박고, 앞 집게(72,128)와 뒷 집게(95,130)가 **서로 마주보는 방향으로 회전해 물리적으로 닫힙니다.** 타격 프레임에 시안 아이바가 최대 발광합니다.",
        hit:"고도 하강. 기체가 뒤(+x)로 밀리며 고도를 잃고, 집게가 크게 흔들리고 아이바가 깜빡입니다.",
        death:"격추 후 자폭. 추력을 잃고 기체가 회전하며 낙하하고, 착지 순간 마젠타 코어 섬광과 함께 시안 기체 파편 16조각이 방사형으로 흩어지며 회색 재가 떠오릅니다.",
        skill:"패닉 확산 — 아군 진영 전체 가속. 기체가 고도를 올려 코어를 개방하고, 시안 링 3겹이 자기 위치에서 좌우 양쪽으로 퍼져나갑니다. 링이 지나간 자리마다 아군 적의 발밑에 시안 잔영 링이 남아 가속 상태를 표시하고, 좌우로 뻗는 속도 스트릭이 가속 방향을 알려줍니다. (자폭 이펙트는 사망 모션으로 이동)"
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph), sl=sin(PI2*(ph-0.18));
        if(mo==="walk"){
          const bob=-9*s;
          A.set("chassis",{t:[0,bob],r:[-1.6*s,84,104]});
          A.set("eye",{t:[0,bob],r:[-1.6*s,84,104]});
          A.set("fin",{t:[0,bob],r:[-3*sl,108,80]});
          A.set("core",{t:[0,bob],r:[-1.6*s,84,104]});
          A.set("clawFront",{t:[0,bob],r:[7*sl,72,128]});
          A.set("clawBack",{t:[0,bob],r:[-6*sl,95,130]});
          A.set("glow",{s:[1+0.12*s,1+0.3*s,80,178],o:0.14+0.12*(0.5-0.5*s)});
        } else if(mo==="attack"){
          const lunge=TR(ph,[[0,0],[.22,7],[.42,-18],[.6,-12],[1,0]],"out");
          const pitch=TR(ph,[[0,0],[.22,-4],[.42,9],[.6,6],[1,0]],"out");
          const snapF=TR(ph,[[0,0],[.22,-14],[.44,26],[.6,22],[1,0]],"out");
          const snapB=TR(ph,[[0,0],[.22,12],[.44,-24],[.6,-20],[1,0]],"out");
          A.set("chassis",{t:[lunge,0],r:[pitch,84,104]});
          A.set("eye",{t:[lunge,0],r:[pitch,84,104]});
          A.set("fin",{t:[lunge,0],r:[pitch-6*S(ph,.22,.5),108,80]});
          A.set("core",{t:[lunge,0],r:[pitch,84,104]});
          A.set("clawFront",{t:[lunge,0],r:[snapF,72,128]});
          A.set("clawBack",{t:[lunge,0],r:[snapB,95,130]});
          A.set("glow",{t:[lunge*0.6,0],s:[1+0.2*S(ph,.22,.44),1,80,178]});
          A.filter(`brightness(${1+0.3*TR(ph,[[0,0],[.42,1],[.6,.4],[1,0]],"out")})`);
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("chassis",{t:[11*k,7*k],r:[6*k,84,104]});
          A.set("eye",{t:[11*k,7*k],r:[6*k,84,104]});
          A.set("fin",{t:[11*k,7*k],r:[16*k,108,80]});
          A.set("core",{t:[11*k,7*k],r:[6*k,84,104]});
          A.set("clawFront",{t:[11*k,7*k],r:[-22*k,72,128]});
          A.set("clawBack",{t:[11*k,7*k],r:[20*k,95,130]});
          A.set("glow",{t:[8*k,0],o:0.1});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.5*k})`);
        } else if(mo==="death"){
          const f=H.inn(S(ph,.06,.72)), fade=S(ph,.62,1);
          const rot=140*f, dy=64*f, dx=16*f;
          ["chassis","eye","core"].forEach(id=>A.set(id,{t:[dx,dy],r:[rot,84,104]}));
          A.set("fin",{t:[dx,dy],r:[rot+40*f,108,80]});
          A.set("clawFront",{t:[dx,dy],r:[rot-34*f,72,128]});
          A.set("clawBack",{t:[dx,dy],r:[rot+30*f,95,130]});
          A.set("glow",{o:Math.max(0,0.2-0.4*f)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.5*f}) brightness(${1+0.6*TR(ph,[[0,0],[.1,1],[.25,0],[1,0]],"out")})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          const up=-8*r;
          ["chassis","eye","core"].forEach(id=>A.set(id,{t:[0,up]}));
          A.set("fin",{t:[0,up]});
          A.set("clawFront",{t:[0,up],r:[-16*r,72,128]});
          A.set("clawBack",{t:[0,up],r:[14*r,95,130]});
          A.set("glow",{s:[1+0.2*r,1+0.2*r,80,178],o:0.2+0.15*Math.abs(p)});
          A.filter(`drop-shadow(0 0 ${6+8*Math.abs(p)}px rgba(45,226,230,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 14. BEAR TROOPER ============
    const trooper = {
      kr:"베어 트루퍼", en:"Bear Trooper", file:"assets/14-bear-trooper.svg", vb:"0 0 170 205", walkLabel:"걷기",
      parts:["glow","legBack","legFront","torso","core","backArm","cannonArm","muzzle","head","crest"],
      markup:`
<g id="glow"><ellipse cx="80" cy="190" rx="40" ry="5.5" fill="#2DE2E6" opacity=".22" filter="url(#nGlowBig)"/></g>
<g id="legBack"><g transform="translate(14,0)">
  <path d="M84 150 L88 172 L68 174 L64 150 Z" fill="#131A28" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M92 172 L64 172 L60 186 L96 186 Z" fill="#151D2C" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M68 186 L92 186 L90 191 L70 191 Z" fill="#2DE2E6" opacity=".6" filter="url(#nGlow)"/>
  <path d="M84 150 L88 172 L68 174 L64 150 Z" fill="#000" opacity=".38"/>
  <path d="M92 172 L64 172 L60 186 L96 186 Z" fill="#000" opacity=".38"/>
</g></g>
<g id="legFront"><g transform="translate(-9,0)">
  <path d="M84 150 L88 172 L68 174 L64 150 Z" fill="#131A28" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M92 172 L64 172 L60 186 L96 186 Z" fill="#151D2C" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M68 186 L92 186 L90 191 L70 191 Z" fill="#2DE2E6" opacity=".6" filter="url(#nGlow)"/>
</g></g>
<g id="torso">
  <path d="M96 116 L52 120 L44 146 L50 162 L104 158 L108 130 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M96 116 L108 130 L104 158 L94 159 L100 130 Z" fill="#4A5F82" opacity=".42"/>
</g>
<g id="core">
  <path d="M50 128 L78 124 L82 148 L52 152 Z" fill="#080D16" stroke="#FF3CAC" stroke-width="2.6"/>
  <path d="M56 132 L68 130 L70 144 L58 146 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/>
</g>
<g id="backArm">
  <path d="M100 112 L128 122 L122 142 L96 132 Z" fill="#212D42" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M104 118 L124 126" stroke="#2DE2E6" stroke-width="2.6" opacity=".7"/>
</g>
<g id="cannonArm">
  <path d="M52 118 L28 128 L24 146 L44 142 Z" fill="#1B2436" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <g id="muzzle">
    <ellipse cx="26" cy="137" rx="5" ry="8" fill="#050A11" stroke="#070A11" stroke-width="3"/>
    <circle cx="27" cy="137" r="3" fill="#FF3CAC" filter="url(#nGlow)"/>
  </g>
</g>
<g id="head">
  <path d="M104 88 L100 58 L80 40 L48 38 L24 56 L14 84 L18 110 L38 128 L82 126 Z" fill="url(#nHelm)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M98 70 L80 46 L50 44 L28 60 L36 66 L56 54 L82 58 Z" fill="#5A729B" opacity=".4"/>
  <path d="M96 92 L98 108 L104 88 L100 74 Z" fill="#0B1019" stroke="#070A11" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M60 62 L22 74 L12 96 L58 84 Z" fill="#26344B" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M62 84 L14 92 L12 110 L64 104 Z" fill="#050A11" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M60 89 L18 96 L17 106 L61 100 Z" fill="#2DE2E6" filter="url(#nGlow)"/>
  <path d="M20 95 L38 92 L39 100 L21 103 Z" fill="#EEFEFF" opacity=".8"/>
  <path d="M62 108 L18 114 L26 128 L44 134 L64 126 Z" fill="#151E2D" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M30 116 L48 113 M32 122 L46 120" stroke="#2DE2E6" stroke-width="2.2" opacity=".8"/>
</g>
<g id="crest"><path d="M74 42 L104 16 L84 24 L58 38 Z" fill="#FF3CAC" opacity=".95" filter="url(#nGlow)"/></g>`,
      notes:{
        walk:"중량 기계 보행. 뒷다리(84,150)·앞다리(71,150) 힙 피벗으로 ±22° 교차하며, 무릎 접지 프레임에 스러스터 솔이 번쩍입니다. **시안 비저 바는 몸통 회전을 역보정해 항상 완벽히 수평** — 얼굴 없는 기계의 무표정이 유지됩니다. 마젠타 백크레스트 핀이 관성으로 늦게 흔들립니다.",
        attack:"팔 캐논 3점사. 캐논 팔이 어깨(52,124)를 축으로 들어올려 정면(-x)에 잠기고, 머즐에 마젠타 차지 글로우가 커지다 발사 프레임에 폭발합니다. 반동이 어깨를 뒤(+x)로 밀고 몸통이 젖혀지며 다리가 버팁니다.",
        hit:"뒤로 밀리는 피격. 몸통·머리가 +x로 밀리고 비저가 깜빡이며, 캐논 팔이 조준을 잃고 흔들립니다.",
        death:"기능 정지. 무릎이 꺾여 주저앉은 뒤 발밑(80,188)을 축으로 뒤로 넘어지고, 비저·코어·스러스터 발광이 순차적으로 꺼집니다.",
        skill:"공매도 압박 — 전방 타워 1기 락온 디버프. 대상이 플레이어 쪽입니다. 마젠타 조준 브래킷이 크게 열렸다가 대상 위로 조여들며 락온되고, 총구에서 3겹 디버프 빔이 지속 조사됩니다. 대상 위에 하락 화살표가 뜨고 하단 게이지 4칸이 순차 점등해 사격 속도 감소량을 표시합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        if(mo==="walk"){
          const bob=-3.4*Math.abs(s);
          A.set("legBack",{r:[-22*s,90,150]});
          A.set("legFront",{r:[20*s,67,150]});
          A.set("torso",{t:[0,bob],r:[1.8*s,78,150]});
          A.set("core",{t:[0,bob],r:[1.8*s,78,150]});
          A.set("head",{t:[0,bob-0.8],r:[-1.8*s,60,100]});
          A.set("crest",{t:[0,bob],r:[-9*sin(PI2*(ph-0.18)),74,42]});
          A.set("backArm",{t:[0,bob],r:[-11*s,102,120]});
          A.set("cannonArm",{t:[0,bob],r:[9*s,52,124]});
          A.set("glow",{s:[1-0.05*Math.abs(s),1,80,190]});
        } else if(mo==="attack"){
          const raise=TR(ph,[[0,0],[.26,-14],[.48,-9],[.66,-9],[1,0]],"out");
          const rec=TR(ph,[[0,0],[.26,-4],[.5,13],[.68,6],[1,0]],"out");
          A.set("cannonArm",{r:[raise,52,124],t:[rec,0]});
          const chg=TR(ph,[[0,1],[.3,1.5],[.46,2.3],[.5,3],[.56,1.2],[1,1]],"out");
          A.set("muzzle",{s:[chg,chg,26,137]});
          A.set("torso",{t:[rec*0.8,0],r:[TR(ph,[[0,0],[.5,-5],[1,0]],"out"),78,150]});
          A.set("core",{t:[rec*0.8,0],r:[TR(ph,[[0,0],[.5,-5],[1,0]],"out"),78,150]});
          A.set("head",{t:[rec*0.7,0],r:[TR(ph,[[0,0],[.5,-4],[1,0]],"out"),60,100]});
          A.set("crest",{r:[TR(ph,[[0,0],[.5,18],[.75,-6],[1,0]],"out"),74,42]});
          A.set("backArm",{t:[rec*1.2,0],r:[TR(ph,[[0,0],[.5,10],[1,0]],"out"),102,120]});
          A.set("legBack",{t:[rec*0.55,0],r:[TR(ph,[[0,0],[.5,14],[.78,5],[1,0]],"out"),90,150]});
          A.set("legFront",{t:[rec*0.55,0],r:[TR(ph,[[0,0],[.5,-12],[.78,-4],[1,0]],"out"),67,150]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("torso",{t:[10*k,0],r:[9*k,78,150]});
          A.set("core",{t:[10*k,0],r:[9*k,78,150]});
          A.set("head",{t:[13*k,0],r:[13*k,60,100]});
          A.set("crest",{r:[-24*k,74,42]});
          A.set("legBack",{r:[13*k,90,150]});
          A.set("legFront",{r:[17*k,71,150],t:[4*k,0]});
          A.set("backArm",{t:[11*k,0],r:[15*k,102,120]});
          A.set("cannonArm",{t:[12*k,0],r:[18*k,52,124]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.55*k})`);
        } else if(mo==="death"){
          const kn=S(ph,.05,.3), fall=H.inn(S(ph,.28,.72)), rest=S(ph,.72,.9), fade=S(ph,.86,1);
          A.set("root",{r:[88*fall,80,188]});
          A.set("legBack",{r:[-40*kn+16*fall,90,150]});
          A.set("legFront",{r:[46*kn-20*fall,67,150]});
          A.set("torso",{t:[0,11*kn],r:[7*kn,78,150]});
          A.set("core",{t:[0,11*kn],r:[7*kn,78,150]});
          A.set("head",{t:[0,11*kn],r:[-18*kn-20*fall,60,100]});
          A.set("crest",{r:[30*fall+10*rest,74,42]});
          A.set("backArm",{t:[0,11*kn],r:[36*fall,102,120]});
          A.set("cannonArm",{t:[0,11*kn],r:[40*fall,52,124]});
          A.set("glow",{s:[1+0.2*fall,1-0.5*fade,80,190],o:Math.max(0,0.22-0.3*fall)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.75*fall}) brightness(${1-0.35*fall})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("legBack",{r:[18*r,90,150]});
          A.set("legFront",{r:[-18*r,67,150]});
          A.set("torso",{t:[0,4*r],r:[-3*r,78,150]});
          A.set("core",{t:[0,4*r],r:[-3*r,78,150]});
          A.set("head",{t:[0,4*r],r:[2*r,60,100]});
          A.set("crest",{r:[-8*r,74,42]});
          A.set("cannonArm",{t:[0,4*r],r:[-12*r,52,124]});
          A.set("backArm",{t:[0,4*r],r:[6*r,102,120]});
          const m=1+0.6*r+0.2*Math.abs(p);
          A.set("muzzle",{s:[m,m,26,137]});
          A.filter(`drop-shadow(0 0 ${7+9*Math.abs(p)}px rgba(255,60,172,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 15. INFLATION CRAWLER ============
    const crawler = {
      kr:"인플레이션 크롤러", en:"Inflation Crawler", file:"assets/15-inflation-crawler.svg", vb:"0 40 175 165", walkLabel:"기어가기",
      parts:["glow","legA","legB","legC","legD","carapace","strip","arrow1","arrow2","sensor","spikes"],
      markup:`
<g id="glow"><ellipse cx="80" cy="188" rx="46" ry="5.5" fill="#FF3CAC" opacity=".2" filter="url(#nGlowBig)"/></g>
<g id="legA"><path d="M44 128 L30 156 L38 182 L52 180 L44 156 L56 134 Z" fill="#131A28" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/></g>
<g id="legB"><path d="M112 126 L128 152 L122 180 L108 178 L114 154 L102 132 Z" fill="#131A28" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/></g>
<g id="legC"><path d="M62 132 L52 158 L60 182 L74 180 L64 158 L74 136 Z" fill="#1B2436" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/></g>
<g id="legD"><path d="M96 130 L108 156 L100 182 L86 180 L94 156 L86 134 Z" fill="#1B2436" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/></g>
<g id="carapace">
  <path d="M28 118 L52 92 L112 88 L136 112 L132 138 L44 144 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="5.5" stroke-linejoin="round"/>
  <path d="M112 88 L136 112 L132 138 L118 140 L124 112 Z" fill="#4A5F82" opacity=".42"/>
  <path d="M56 96 L108 92 L112 100 L58 104 Z" fill="#3B4C6B" opacity=".7"/>
</g>
<g id="strip">
  <path d="M50 112 L114 106 L116 118 L50 124 Z" fill="#080D16" stroke="#FF3CAC" stroke-width="2.8"/>
  <path d="M58 113 L108 109 L109 117 L58 121 Z" fill="#FF3CAC" opacity=".85" filter="url(#nGlow)"/>
</g>
<g id="arrow1"><path d="M70 128 L78 118 L86 128 L82 128 L82 138 L74 138 L74 128 Z" fill="#FFB3DE" opacity=".9" filter="url(#nGlow)"/></g>
<g id="arrow2"><path d="M92 128 L100 118 L108 128 L104 128 L104 138 L96 138 L96 128 Z" fill="#FFB3DE" opacity=".7" filter="url(#nGlow)"/></g>
<g id="sensor">
  <path d="M28 118 L14 108 L10 124 L26 130 Z" fill="#1B2436" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <circle cx="17" cy="118" r="4" fill="#FF3CAC" filter="url(#nGlow)"/>
</g>
<g id="spikes">
  <path d="M52 92 L44 76 L58 80 L66 90 Z" fill="#212D42" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M98 88 L106 72 L114 82 L110 90 Z" fill="#212D42" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
</g>`,
      notes:{
        walk:"4족 기어가기. 다리 4개를 **대각선 쌍으로 교차** 구동합니다 — (앞바깥 legA + 뒤안쪽 legD)가 한 쌍, (앞안쪽 legC + 뒤바깥 legB)가 반대 위상. 실제 곤충형 보행이라 몸체가 좌우로 뒤뚱거리며 무게가 실린 쪽으로 기울고, 센서 헤드가 지면을 훑습니다.",
        attack:"앞판 들었다 내려찍기. 뒷다리(legB·legD)를 축(110,180)으로 몸 전체가 뒤로 젖혀지며 앞판이 들리고, 앞다리가 공중에서 접힌 뒤 한 번에 내려꽂힙니다. 착지 프레임에 전면 마젠타 광 스트립이 최대로 번쩍입니다.",
        hit:"4족이 각기 다른 위상으로 휘청이고 몸체가 뒤로 밀리며 광 스트립이 깜빡입니다.",
        death:"다리 4개가 각각 다른 방향으로 벌어져 꺾이고 몸체가 지면에 주저앉으며, 광 스트립 → 상승 화살표 → 센서 순서로 발광이 꺼집니다.",
        skill:"인플레 오라 — 아군 진영 전체 강화. 아군 사제의 매끈한 황금 링과 확실히 구분되도록 독성 옐로그린(#C8F03C) + 톱니(sawtooth) 링을 씁니다. 상승 화살표 5개는 위로 갈수록 가로로 찌그러지고 좌우로 떨려 과열된 인플레를 표현합니다."
      },
      anim:(ph,mo,A)=>{
        const g1=sin(PI2*ph), g2=sin(PI2*ph+Math.PI);
        if(mo==="walk"){
          const rock=1.6*g1, bob=-2*Math.abs(g1);
          A.set("legA",{r:[-17*g1,50,130]});
          A.set("legD",{r:[-15*g1,91,132]});
          A.set("legC",{r:[-17*g2,68,134]});
          A.set("legB",{r:[-15*g2,107,129]});
          A.set("carapace",{t:[0,bob],r:[rock,82,116]});
          A.set("strip",{t:[0,bob],r:[rock,82,116]});
          A.set("arrow1",{t:[0,bob],r:[rock,82,116]});
          A.set("arrow2",{t:[0,bob],r:[rock,82,116]});
          A.set("spikes",{t:[0,bob],r:[rock,82,116]});
          A.set("sensor",{t:[0,bob],r:[rock-4*g2,26,124]});
          A.set("glow",{s:[1-0.04*Math.abs(g1),1,80,188]});
        } else if(mo==="attack"){
          const rear=TR(ph,[[0,0],[.34,-24],[.44,-26],[.56,10],[.7,3],[1,0]],"out");
          const lift=TR(ph,[[0,0],[.38,-30],[.5,16],[.66,4],[1,0]],"out");
          ["carapace","strip","arrow1","arrow2","spikes"].forEach(id=>A.set(id,{r:[rear,110,180]}));
          A.set("sensor",{r:[rear+lift*0.5,110,180]});
          A.set("legA",{r:[lift,50,130]});
          A.set("legC",{r:[lift*0.8,68,134]});
          A.set("legB",{r:[TR(ph,[[0,0],[.4,12],[.56,-6],[1,0]],"out"),107,129]});
          A.set("legD",{r:[TR(ph,[[0,0],[.4,10],[.56,-5],[1,0]],"out"),91,132]});
          const fl=TR(ph,[[0,0],[.5,0],[.56,1],[.75,.2],[1,0]],"out");
          A.set("strip",{r:[rear,110,180],s:[1+0.06*fl,1+0.3*fl,82,114]});
          A.filter(`brightness(${1+0.4*fl})`);
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          ["carapace","strip","arrow1","arrow2","spikes"].forEach(id=>A.set(id,{t:[9*k,0],r:[5*k,82,116]}));
          A.set("sensor",{t:[11*k,0],r:[14*k,26,124]});
          A.set("legA",{r:[16*k,50,130]});
          A.set("legB",{r:[-13*k,107,129]});
          A.set("legC",{r:[-15*k,68,134]});
          A.set("legD",{r:[12*k,91,132]});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.55*k})`);
        } else if(mo==="death"){
          const spl=H.inn(S(ph,.05,.55)), col=H.inn(S(ph,.2,.72)), fade=S(ph,.72,1);
          A.set("legA",{r:[-58*spl,50,130]});
          A.set("legB",{r:[52*spl,107,129]});
          A.set("legC",{r:[-40*spl,68,134]});
          A.set("legD",{r:[46*spl,91,132]});
          ["carapace","spikes"].forEach(id=>A.set(id,{t:[0,26*col],s:[1+0.08*col,1-0.34*col,82,140],k:[-3*col,82,140]}));
          A.set("strip",{t:[0,26*col],s:[1+0.08*col,1-0.34*col,82,140],o:Math.max(0,1-1.6*col)});
          A.set("arrow1",{t:[0,26*col],o:Math.max(0,0.9-2*col)});
          A.set("arrow2",{t:[0,26*col],o:Math.max(0,0.7-2*col)});
          A.set("sensor",{t:[-6*col,28*col],r:[-24*col,26,124],o:Math.max(0,1-1.3*col)});
          A.set("glow",{s:[1+0.16*col,1-0.5*fade,80,188],o:Math.max(0,0.2-0.3*col)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.75*col}) brightness(${1-0.35*col})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          const gs=1+0.1*r;
          ["carapace","spikes","strip"].forEach(id=>A.set(id,{s:[gs,gs,82,140],t:[0,-3*r]}));
          A.set("legA",{r:[-8*r,50,130]});
          A.set("legB",{r:[8*r,107,129]});
          A.set("legC",{r:[-6*r,68,134]});
          A.set("legD",{r:[6*r,91,132]});
          A.set("sensor",{s:[gs,gs,82,140],t:[0,-3*r]});
          A.set("arrow1",{s:[gs,gs,82,140],t:[0,-3*r],o:ph>.28?0.95:0.2});
          A.set("arrow2",{s:[gs,gs,82,140],t:[0,-3*r],o:ph>.52?0.95:0.15});
          A.set("glow",{s:[1+0.2*r,1+0.2*r,80,188],o:0.2+0.15*Math.abs(p)});
          A.filter(`drop-shadow(0 0 ${7+9*Math.abs(p)}px rgba(255,60,172,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 16. FLASH CRASH ============
    const flash = {
      kr:"플래시 크래시", en:"Flash Crash", file:"assets/16-flash-crash.svg", vb:"0 0 175 205", walkLabel:"질주",
      parts:["glow","streaks","legBack","legFront","torso","core","head","headFin","shoulderFin"],
      markup:`
<g id="glow"><ellipse cx="80" cy="190" rx="30" ry="4.5" fill="#2DE2E6" opacity=".22" filter="url(#nGlowBig)"/></g>
<g id="streaks">
  <path d="M120 60 L146 54 M118 76 L152 68 M122 94 L144 88 M124 112 L150 106" stroke="#2DE2E6" stroke-width="3" opacity=".45" stroke-linecap="round"/>
  <path d="M126 130 L148 124" stroke="#FF3CAC" stroke-width="3" opacity=".4" stroke-linecap="round"/>
</g>
<g id="legBack"><path d="M88 106 L104 138 L92 170 L82 186 L72 182 L82 166 L92 138 L78 112 Z" fill="#131A28" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/></g>
<g id="legFront"><path d="M70 108 L58 140 L66 168 L56 186 L46 182 L56 166 L50 140 L60 104 Z" fill="#1B2436" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/></g>
<g id="torso">
  <path d="M58 62 L100 54 L112 78 L108 106 L64 116 L50 92 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M100 54 L112 78 L108 106 L98 108 L104 78 Z" fill="#4A5F82" opacity=".42"/>
</g>
<g id="core">
  <path d="M56 76 L86 70 L90 92 L58 98 Z" fill="#080D16" stroke="#FF3CAC" stroke-width="2.6"/>
  <path d="M62 80 L78 77 L80 90 L64 93 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/>
</g>
<g id="head">
  <path d="M58 62 L34 50 L20 58 L30 72 L52 74 Z" fill="url(#nHelm)" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M50 56 L26 56 L24 64 L52 66 Z" fill="#2DE2E6" filter="url(#nGlow)"/>
  <path d="M28 57 L40 57 L40 63 L28 63 Z" fill="#EEFEFF" opacity=".85"/>
</g>
<g id="headFin"><path d="M60 46 L94 24 L76 34 L54 50 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/></g>
<g id="shoulderFin"><path d="M104 60 L128 48 L134 56 L110 70 Z" fill="#1B2436" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/></g>
`,
      notes:{
        walk:"전력 질주. 블레이드 다리를 힙(86,110)·(66,108) 축으로 **±42°까지 극단적으로 벌려** 스트라이드를 최대화하고, 몸통이 무게중심을 넘어 -x로 깊이 기울어집니다. 뒤쪽 시안 스트릭이 스텝마다 늘어나 정지 프레임에서도 속도가 읽힙니다.",
        attack:"대시 어택. 몸통을 scaleX로 진행 방향으로 늘려 모션블러처럼 뭉개고(1.0→1.28) 머리와 한쪽 다리만 형태를 유지합니다. 헤드 핀이 뒤로 완전히 눕고 스트릭이 최대로 늘어납니다.",
        hit:"유리대포. 얇은 기체가 크게 튕겨나가며 다리가 접히고 시안 비저가 깜빡입니다.",
        death:"자세를 잃고 앞으로 고꾸라짐. 블레이드 다리가 꺾이고 스트릭이 흩어지며 잔상만 남기고 소멸합니다.",
        skill:"급락 순간이동. 질주 잔상과 겹치지 않게 완전히 다른 이펙트입니다. 몸이 가로 스캔라인 9줄로 분해돼 사라지고, 흰 스트릭이 전방으로 뻗은 뒤 도착 지점에서 역순으로 재조립됩니다. 경로 전체에 마젠타 계단식 하락 그래프가 그려지며 도착점에 하락 화살표가 찍힙니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        if(mo==="walk"){
          const bob=-5*Math.abs(s);
          A.set("legBack",{r:[-42*s,86,110]});
          A.set("legFront",{r:[42*s,66,108]});
          A.set("torso",{t:[0,bob],r:[-8+2.5*s,74,110]});
          A.set("core",{t:[0,bob],r:[-8+2.5*s,74,110]});
          A.set("head",{t:[-1,bob-1],r:[-8+1.5*s,74,110]});
          A.set("headFin",{t:[0,bob],r:[-8-11*sin(PI2*(ph-0.16)),60,46]});
          A.set("shoulderFin",{t:[0,bob],r:[-8-7*sin(PI2*(ph-0.2)),106,62]});
          A.set("streaks",{s:[1+0.5*Math.abs(s),1,120,90],o:0.45+0.4*Math.abs(s)});
          A.set("glow",{s:[1+0.3*Math.abs(s),1,80,190]});
        } else if(mo==="attack"){
          const dash=TR(ph,[[0,0],[.24,10],[.44,-26],[.62,-16],[1,0]],"out");
          const blur=TR(ph,[[0,1],[.24,1.02],[.44,1.28],[.62,1.12],[1,1]],"out");
          A.set("torso",{t:[dash,0],s:[blur,1/Math.sqrt(blur),100,90],r:[-14*S(ph,.24,.44),74,110]});
          A.set("core",{t:[dash,0],s:[blur,1/Math.sqrt(blur),100,90],o:0.6});
          A.set("head",{t:[dash*1.1,0],r:[-12*S(ph,.24,.44),74,110]});
          A.set("headFin",{t:[dash,0],r:[-34*S(ph,.2,.46),60,46]});
          A.set("shoulderFin",{t:[dash*0.9,0],r:[-26*S(ph,.2,.46),106,62]});
          A.set("legBack",{r:[TR(ph,[[0,0],[.24,-30],[.46,34],[.7,10],[1,0]],"out"),86,110]});
          A.set("legFront",{r:[TR(ph,[[0,0],[.24,26],[.46,-30],[.7,-8],[1,0]],"out"),66,108]});
          A.set("streaks",{s:[1+1.4*S(ph,.2,.5),1,120,90],o:0.4+0.5*S(ph,.2,.5)});
          A.set("glow",{t:[dash*0.5,0],s:[1+0.6*S(ph,.24,.5),1,80,190]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("torso",{t:[15*k,0],r:[14*k,74,110]});
          A.set("core",{t:[15*k,0],r:[14*k,74,110]});
          A.set("head",{t:[18*k,0],r:[20*k,74,110]});
          A.set("headFin",{t:[16*k,0],r:[-30*k,60,46]});
          A.set("shoulderFin",{t:[16*k,0],r:[24*k,106,62]});
          A.set("legBack",{r:[26*k,86,110]});
          A.set("legFront",{r:[-24*k,66,108],t:[8*k,0]});
          A.set("streaks",{o:0.2});
          A.filter(`brightness(${1+1.6*k}) saturate(${1-0.6*k})`);
        } else if(mo==="death"){
          const fall=H.inn(S(ph,.06,.6)), rest=S(ph,.6,.86), fade=S(ph,.6,1);
          A.set("root",{r:[-74*fall,74,188]});
          A.set("legBack",{r:[-46*fall,86,110]});
          A.set("legFront",{r:[52*fall,66,108]});
          A.set("torso",{r:[-16*fall,74,110]});
          A.set("core",{r:[-16*fall,74,110],o:Math.max(0,1-1.5*fall)});
          A.set("head",{r:[-26*fall-10*rest,74,110]});
          A.set("headFin",{r:[-48*fall,60,46],o:Math.max(0,0.9-1.3*fall)});
          A.set("shoulderFin",{r:[-38*fall,106,62]});
          A.set("streaks",{s:[1+1.2*fall,1,120,90],o:Math.max(0,0.45-0.8*fall)});
          A.set("glow",{s:[1+0.2*fall,1-0.5*fade,80,190],o:Math.max(0,0.22-0.3*fall)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.8*fall}) brightness(${1-0.3*fall})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("legBack",{r:[-26*r,86,110]});
          A.set("legFront",{r:[22*r,66,108]});
          A.set("torso",{t:[0,4*r],r:[-16*r,74,110]});
          A.set("core",{t:[0,4*r],r:[-16*r,74,110]});
          A.set("head",{t:[-2*r,4*r],r:[-14*r,74,110]});
          A.set("headFin",{t:[0,4*r],r:[-30*r,60,46]});
          A.set("shoulderFin",{t:[0,4*r],r:[-22*r,106,62]});
          A.set("streaks",{s:[1+1.6*r,1,120,90],o:0.45+0.45*Math.abs(p)});
          A.filter(`drop-shadow(0 0 ${7+10*Math.abs(p)}px rgba(45,226,230,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 17. HEDGE SHIELDBEARER ============
    const hedge = {
      kr:"헤지 실드베어러", en:"Hedge Shieldbearer", file:"assets/17-hedge-shieldbearer.svg", vb:"0 0 170 205", walkLabel:"걷기",
      parts:["glow","legBack","legFront","torso","core","backArm","head","crest","emitter","shield"],
      markup:`
<g id="glow"><ellipse cx="86" cy="190" rx="40" ry="5.5" fill="#2DE2E6" opacity=".22" filter="url(#nGlowBig)"/></g>
<g id="legBack"><g transform="translate(13,0)">
  <path d="M96 148 L100 172 L80 174 L76 148 Z" fill="#131A28" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M104 172 L76 172 L72 186 L108 186 Z" fill="#151D2C" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M80 186 L104 186 L102 191 L82 191 Z" fill="#2DE2E6" opacity=".6" filter="url(#nGlow)"/>
  <path d="M96 148 L100 172 L80 174 L76 148 Z" fill="#000" opacity=".38"/>
  <path d="M104 172 L76 172 L72 186 L108 186 Z" fill="#000" opacity=".38"/>
</g></g>
<g id="legFront"><g transform="translate(-9,0)">
  <path d="M96 148 L100 172 L80 174 L76 148 Z" fill="#131A28" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M104 172 L76 172 L72 186 L108 186 Z" fill="#151D2C" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M80 186 L104 186 L102 191 L82 191 Z" fill="#2DE2E6" opacity=".6" filter="url(#nGlow)"/>
</g></g>
<g id="torso">
  <path d="M108 112 L64 116 L56 144 L62 162 L116 156 L120 128 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M108 112 L120 128 L116 156 L106 157 L112 128 Z" fill="#4A5F82" opacity=".42"/>
</g>
<g id="core">
  <path d="M62 124 L92 120 L96 146 L64 150 Z" fill="#080D16" stroke="#FF3CAC" stroke-width="2.6"/>
  <path d="M68 128 L82 126 L84 142 L70 144 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/>
</g>
<g id="backArm"><path d="M112 106 L138 116 L132 136 L108 126 Z" fill="#212D42" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/></g>
<g id="head">
  <path d="M104 84 L100 58 L82 44 L52 44 L34 62 L30 88 L46 108 L88 108 Z" fill="url(#nHelm)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M98 68 L82 50 L54 50 L38 64 L46 70 L60 58 L84 60 Z" fill="#5A729B" opacity=".4"/>
  <path d="M70 74 L32 70 L28 88 L72 90 Z" fill="#050A11" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M68 78 L34 75 L33 85 L69 86 Z" fill="#2DE2E6" filter="url(#nGlow)"/>
  <path d="M36 77 L52 78 L52 85 L36 84 Z" fill="#EEFEFF" opacity=".8"/>
</g>
<g id="crest"><path d="M74 46 L98 22 L82 30 L62 42 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/></g>
<g id="emitter"><path d="M76 106 L74 120 L86 128 L96 118 L94 104 Z" fill="#101724" stroke="#070A11" stroke-width="4.5" stroke-linejoin="round"/></g>
<g id="shield">
  <g filter="url(#nGlow)"><path d="M30 96 L14 110 L14 148 L30 164 L48 148 L48 110 Z" fill="#2DE2E6" fill-opacity=".18" stroke="#2DE2E6" stroke-width="3.4"/></g>
  <path d="M30 114 L20 121 L20 139 L30 146 L40 139 L40 121 Z" fill="none" stroke="#FF3CAC" stroke-width="2.4" opacity=".85"/>
  <path d="M16 106 L26 112 M42 144 L47 148" stroke="#2DE2E6" stroke-width="2.2" opacity=".6"/>
</g>`,
      notes:{
        walk:"전진 보행. 다리는 ±19° 교차하고 몸통은 걸음을 흡수해 오르내리지만, **육각 홀로 실드는 몸의 상하·회전을 전부 역보정해 공간에 완벽히 고정**됩니다 — 실드가 주인공인 유닛이라 화면에서 실드만 흔들리지 않습니다. 실드 표면은 미세하게 시안으로 맥동합니다.",
        attack:"실드 배시. 몸 전체가 실드 뒤로 실려 -x로 22px 밀고 들어가고, 접촉 프레임에 실드가 1.14배로 팽창하며 최대 발광합니다. 다리가 버티며 미끄러지고 에미터 팔이 실드를 받칩니다.",
        hit:"실드가 받아냄. 실드 표면이 육각 파문처럼 진동하고 몸통은 뒤로 밀리지만 실드는 정면을 유지하려 버팁니다.",
        death:"실드 파쇄 후 붕괴. 육각 실드에 파문이 퍼진 뒤 육각 조각 11개로 쪼개져 낙하하며 마젠타 파편이 흩어지고, 실드를 잃은 몸체가 그대로 주저앉습니다.",
        skill:"헤지 커버 — 주변 아군에게 실드 부여. 파쇄가 아니라 생성입니다. 이미터가 링을 뿜은 뒤 주변 3개 지점에 육각 실드가 변을 하나씩 그려가며 생성되고(6변 완성 후 채워짐), 완성된 실드는 육각 파문을 내뿜으며 이미터와 광선으로 연결됩니다. (파쇄 이펙트는 사망 모션으로 이동)"
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        if(mo==="walk"){
          const bob=-3*Math.abs(s), rot=1.6*s;
          A.set("legBack",{r:[-19*s,101,148]});
          A.set("legFront",{r:[17*s,79,148]});
          A.set("torso",{t:[0,bob],r:[rot,88,148]});
          A.set("core",{t:[0,bob],r:[rot,88,148]});
          A.set("backArm",{t:[0,bob],r:[-9*s,114,112]});
          A.set("head",{t:[0,bob-0.7],r:[-rot,66,90]});
          A.set("crest",{t:[0,bob],r:[-8*sin(PI2*(ph-0.18)),74,46]});
          A.set("emitter",{t:[0,bob*0.4],r:[rot*0.3,86,116]});
          A.set("shield",{t:[0,0],s:[1+0.012*Math.abs(s),1+0.012*Math.abs(s),31,130]});
          A.set("glow",{s:[1-0.05*Math.abs(s),1,86,190]});
        } else if(mo==="attack"){
          const push=TR(ph,[[0,0],[.24,9],[.46,-22],[.64,-15],[1,0]],"out");
          ["torso","core","backArm","head","crest","emitter"].forEach(id=>A.set(id,{t:[push,0]}));
          A.set("torso",{t:[push,0],r:[TR(ph,[[0,0],[.24,4],[.46,-6],[1,0]],"out"),88,148]});
          A.set("core",{t:[push,0],r:[TR(ph,[[0,0],[.46,-6],[1,0]],"out"),88,148]});
          A.set("head",{t:[push,0],r:[TR(ph,[[0,0],[.46,-5],[1,0]],"out"),66,90]});
          A.set("crest",{t:[push,0],r:[TR(ph,[[0,0],[.46,16],[.7,-5],[1,0]],"out"),74,46]});
          A.set("shield",{t:[push*1.15,0],s:[TR(ph,[[0,1],[.46,1.14],[.62,1.06],[1,1]],"out"),TR(ph,[[0,1],[.46,1.14],[.62,1.06],[1,1]],"out"),31,130]});
          A.set("legBack",{t:[push*0.6,0],r:[TR(ph,[[0,0],[.24,-12],[.46,18],[.75,7],[1,0]],"out"),101,148]});
          A.set("legFront",{t:[push*0.6,0],r:[TR(ph,[[0,0],[.24,10],[.46,-16],[.75,-6],[1,0]],"out"),79,148]});
          A.set("glow",{t:[push*0.6,0]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          A.set("torso",{t:[10*k,0],r:[8*k,88,148]});
          A.set("core",{t:[10*k,0],r:[8*k,88,148]});
          A.set("backArm",{t:[11*k,0],r:[14*k,114,112]});
          A.set("head",{t:[12*k,0],r:[11*k,66,90]});
          A.set("crest",{r:[-22*k,74,46]});
          A.set("emitter",{t:[7*k,0],r:[6*k,86,116]});
          A.set("legBack",{r:[12*k,101,148]});
          A.set("legFront",{r:[16*k,83,148],t:[4*k,0]});
          const rip=1+0.1*Math.sin(PI2*ph*9)*k;
          A.set("shield",{t:[3*k,0],s:[rip,1+0.14*Math.sin(PI2*ph*7)*k,31,130]});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.5*k})`);
        } else if(mo==="death"){
          const br=H.inn(S(ph,.04,.34)), kn=S(ph,.3,.5), fall=H.inn(S(ph,.44,.82)), fade=S(ph,.8,1);
          A.set("shield",{s:[Math.max(0.04,1-1.1*br),Math.max(0.04,1-1.1*br),31,130],o:Math.max(0,1-1.25*br)*(0.4+0.6*Math.abs(sin(PI2*ph*10)))});
          A.set("root",{r:[86*fall,86,188]});
          A.set("legBack",{r:[-38*kn+16*fall,101,148]});
          A.set("legFront",{r:[44*kn-18*fall,79,148]});
          A.set("torso",{t:[0,10*kn],r:[6*kn,88,148]});
          A.set("core",{t:[0,10*kn],r:[6*kn,88,148],o:Math.max(0,1-1.4*fall)});
          A.set("backArm",{t:[0,10*kn],r:[32*fall,114,112]});
          A.set("head",{t:[0,10*kn],r:[-16*kn-18*fall,66,90]});
          A.set("crest",{r:[26*fall,74,46]});
          A.set("emitter",{t:[0,10*kn],r:[24*fall,86,116]});
          A.set("glow",{s:[1+0.2*fall,1-0.5*fade,86,190],o:Math.max(0,0.22-0.3*fall)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.75*fall}) brightness(${1-0.35*fall})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          A.set("legBack",{r:[14*r,101,148]});
          A.set("legFront",{r:[-14*r,79,148]});
          A.set("torso",{t:[0,3*r],r:[-3*r,88,148]});
          A.set("core",{t:[0,3*r],r:[-3*r,88,148]});
          A.set("head",{t:[0,3*r],r:[2*r,66,90]});
          A.set("crest",{r:[-7*r,74,46]});
          A.set("emitter",{t:[-3*r,2*r],r:[-6*r,86,116]});
          const sc=1+0.25*r+0.03*Math.abs(p);
          A.set("shield",{t:[-4*r,0],s:[sc,sc,31,130]});
          A.filter(`drop-shadow(0 0 ${8+10*Math.abs(p)}px rgba(45,226,230,${.4+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 18. ALGO DRONE ============
    const algo = {
      kr:"알고리즘 드론", en:"Algo Drone", file:"assets/18-algo-drone.svg", vb:"0 0 175 200", walkLabel:"비행",
      parts:["shadow","glow","fuselage","sensor","core","rotor1","rotor2","pylons","nacelle1","nacelle2","payload"],
      markup:`
<g id="shadow"><ellipse cx="80" cy="184" rx="20" ry="3.5" fill="#000" opacity=".55"/></g>
<g id="glow"><ellipse cx="80" cy="182" rx="26" ry="5" fill="#2DE2E6" opacity=".14" filter="url(#nGlowBig)"/></g>
<g id="fuselage">
  <path d="M40 60 L96 46 L124 66 L118 96 L56 110 L32 88 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M96 46 L124 66 L118 96 L106 99 L112 68 Z" fill="#4A5F82" opacity=".42"/>
</g>
<g id="sensor">
  <path d="M32 74 L64 66 L68 88 L36 96 Z" fill="#050A11" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M38 77 L62 71 L64 85 L40 91 Z" fill="#2DE2E6" filter="url(#nGlow)"/>
  <ellipse cx="48" cy="81" rx="7" ry="3.4" fill="#EEFEFF" opacity=".85"/>
</g>
<g id="core">
  <path d="M74 70 L104 62 L108 84 L78 92 Z" fill="#080D16" stroke="#FF3CAC" stroke-width="2.4"/>
  <path d="M82 74 L96 70 L98 82 L84 86 Z" fill="#FF3CAC" opacity=".9" filter="url(#nGlow)"/>
</g>
<g id="rotor1"><g filter="url(#nGlow)"><ellipse cx="34" cy="42" rx="24" ry="7" fill="none" stroke="#2DE2E6" stroke-width="3"/></g></g>
<g id="rotor2"><g filter="url(#nGlow)"><ellipse cx="120" cy="44" rx="24" ry="7" fill="none" stroke="#2DE2E6" stroke-width="3"/></g></g>
<g id="pylons">
  <path d="M40 54 L36 46 M114 54 L118 48" stroke="#1B2436" stroke-width="6" stroke-linecap="round"/>
  <path d="M40 54 L36 46 M114 54 L118 48" stroke="#2DE2E6" stroke-width="2" stroke-linecap="round" opacity=".6"/>
</g>
<g id="nacelle1">
  <path d="M62 108 L84 104 L80 122 L66 124 Z" fill="#141C2A" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M68 122 L80 120 L78 134 L70 135 Z" fill="#2DE2E6" opacity=".55" filter="url(#nGlow)"/>
</g>
<g id="nacelle2">
  <path d="M94 100 L112 96 L110 112 L96 114 Z" fill="#141C2A" stroke="#070A11" stroke-width="4" stroke-linejoin="round"/>
  <path d="M99 112 L110 110 L108 124 L101 125 Z" fill="#2DE2E6" opacity=".45" filter="url(#nGlow)"/>
</g>
<g id="payload"><circle cx="86" cy="112" r="7" fill="#2DE2E6" opacity="0" filter="url(#nGlow)"/></g>`,
      notes:{
        walk:"수평 비행 루프. 다리가 전혀 없고 **로터 링 2개가 각자 회전**합니다(원근을 살려 rx 압축 + 회전 병행). 동체는 진행 방향(-x)으로 기수를 내리고, 하단 나셀 글로우가 부유 위상에 맞춰 맥동합니다. 지면 그림자가 고도에 따라 크기가 변합니다.",
        attack:"페이로드 투하. 하단 나셀이 베이처럼 바깥으로 열리고 시안 페이로드가 아래로 낙하합니다. **무게가 빠지는 순간 동체가 위로 튀어오르고**, 그걸 보정하려 로터 링이 급가속(회전 속도 3배)합니다.",
        hit:"고도 하강. 로터 회전이 순간 끊겨 동체가 기울며 낙하하고 시안 센서 바가 깜빡입니다.",
        death:"추락. 로터가 정지하며 링이 축소되고, 동체가 회전하며 지면으로 떨어져 소멸합니다.",
        skill:"알고 스캔 — 최적 타깃 지정. 지면에 원근 격자(7×4)가 깔리고 흰 스캔 바가 좌에서 우로 훑으며 스파크를 흘립니다. 스캔이 끝나면 마젠타 마름모가 한 칸에 조여들며 락온되고, 코너 티크 4개와 수직 지시선이 대상을 확정합니다. 폭탄 투하는 평타로 유지합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        const spinR=(id,cx,cy,spd)=>{ const t=ph*spd; A.set(id,{r:[t*360,cx,cy],s:[1,Math.max(0.18,Math.abs(Math.cos(PI2*t*2))*0.85+0.18),cx,cy]}); };
        if(mo==="walk"){
          const bob=-7*s;
          ["fuselage","sensor","core","pylons"].forEach(id=>A.set(id,{t:[0,bob],r:[-3+1.2*s,78,78]}));
          A.set("nacelle1",{t:[0,bob],r:[-3+1.2*s,78,78]});
          A.set("nacelle2",{t:[0,bob],r:[-3+1.2*s,78,78]});
          spinR("rotor1",34,42,3); spinR("rotor2",120,44,3.4);
          A.set("rotor1",{r:[ph*1080,34,42],t:[0,bob],s:[1,Math.max(0.2,Math.abs(Math.cos(PI2*ph*6))*0.8+0.2),34,42]});
          A.set("rotor2",{r:[-ph*1200,120,44],t:[0,bob],s:[1,Math.max(0.2,Math.abs(Math.sin(PI2*ph*6))*0.8+0.2),120,44]});
          A.set("payload",{o:0});
          A.set("shadow",{s:[1-0.14*s,1-0.14*s,80,184],o:0.4+0.2*(0.5+0.5*s)});
          A.set("glow",{s:[1-0.1*s,1,80,182]});
        } else if(mo==="attack"){
          const open=TR(ph,[[0,0],[.28,1],[.62,1],[.85,0],[1,0]],"out");
          const kick=TR(ph,[[0,0],[.34,0],[.44,-11],[.66,-4],[1,0]],"out");
          ["fuselage","sensor","core","pylons"].forEach(id=>A.set(id,{t:[0,kick],r:[-3,78,78]}));
          A.set("nacelle1",{t:[0,kick],r:[-3-26*open,72,108]});
          A.set("nacelle2",{t:[0,kick],r:[-3+24*open,102,102]});
          A.set("rotor1",{r:[ph*3200,34,42],t:[0,kick],s:[1,Math.max(0.15,Math.abs(Math.cos(PI2*ph*14))*0.8+0.15),34,42]});
          A.set("rotor2",{r:[-ph*3400,120,44],t:[0,kick],s:[1,Math.max(0.15,Math.abs(Math.sin(PI2*ph*14))*0.8+0.15),120,44]});
          const drop=S(ph,.36,.9);
          A.set("payload",{t:[-6*drop,drop*70],o: ph<.34?0:(1-Math.max(0,(drop-0.6)/0.4)),s:[1+0.3*drop,1+0.3*drop,86,112]});
          A.set("shadow",{s:[1+0.1*open,1,80,184]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          ["fuselage","sensor","core","pylons","nacelle1","nacelle2"].forEach(id=>A.set(id,{t:[12*k,9*k],r:[9*k,78,78]}));
          A.set("rotor1",{r:[ph*400,34,42],t:[12*k,9*k],s:[1,1-0.5*k,34,42]});
          A.set("rotor2",{r:[-ph*400,120,44],t:[12*k,9*k],s:[1,1-0.5*k,120,44]});
          A.set("payload",{o:0});
          A.set("shadow",{s:[1+0.2*k,1,80,184],o:0.3});
          A.filter(`brightness(${1+1.5*k}) saturate(${1-0.5*k})`);
        } else if(mo==="death"){
          const st=S(ph,.04,.4), f=H.inn(S(ph,.1,.76)), fade=S(ph,.66,1);
          const rot=124*f, dy=76*f, dx=14*f;
          ["fuselage","sensor","core","pylons","nacelle1","nacelle2"].forEach(id=>A.set(id,{t:[dx,dy],r:[rot,78,78]}));
          A.set("rotor1",{t:[dx,dy],r:[ph*900*(1-st),34,42],s:[Math.max(0.05,1-st),Math.max(0.05,1-st),34,42],o:Math.max(0,1-1.2*st)});
          A.set("rotor2",{t:[dx,dy],r:[-ph*900*(1-st),120,44],s:[Math.max(0.05,1-st),Math.max(0.05,1-st),120,44],o:Math.max(0,1-1.2*st)});
          A.set("payload",{o:0});
          A.set("shadow",{s:[1+0.5*f,1,80,184],o:Math.max(0,0.55-0.6*f)});
          A.set("glow",{o:Math.max(0,0.14-0.2*f)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.6*f}) brightness(${1-0.2*f})`);
        } else {
          const r=S(ph,0,.3), p=sin(PI2*ph);
          const up=-14*r;
          ["fuselage","sensor","core","pylons"].forEach(id=>A.set(id,{t:[0,up],r:[-2,78,78]}));
          A.set("nacelle1",{t:[0,up],r:[-2-13*r,72,108]});
          A.set("nacelle2",{t:[0,up],r:[-2+12*r,102,102]});
          A.set("rotor1",{r:[ph*2600,34,42],t:[0,up],s:[1,Math.max(0.18,Math.abs(Math.cos(PI2*ph*12))*0.8+0.18),34,42]});
          A.set("rotor2",{r:[-ph*2800,120,44],t:[0,up],s:[1,Math.max(0.18,Math.abs(Math.sin(PI2*ph*12))*0.8+0.18),120,44]});
          A.set("payload",{o:0.35*r,t:[0,4*r]});
          A.set("shadow",{s:[1-0.25*r,1-0.25*r,80,184],o:0.35});
          A.filter(`drop-shadow(0 0 ${7+9*Math.abs(p)}px rgba(45,226,230,${.35+.35*Math.abs(p)}))`);
        }
      }
    };

    // ============ 19. MARGIN CALL TITAN ============
    const titan = {
      kr:"마진콜 타이탄 · BOSS", en:"Margin Call Titan", file:"assets/19-margin-call-titan.svg", vb:"0 0 300 205", walkLabel:"걷기",
      parts:["glow","legBack","legFront","torso","coreGlow","core","clampArm","clampJaw","crest","cannonArm","vents","shoulderVisor"],
      markup:`
<g id="glow"><ellipse cx="150" cy="190" rx="86" ry="7" fill="#FF3CAC" opacity=".22" filter="url(#nGlowBig)"/></g>
<g id="legBack">
  <path d="M186 128 L196 164 L172 168 L162 130 Z" fill="#101724" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M204 164 L166 166 L158 186 L212 186 Z" fill="#141C2A" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M168 186 L206 186 L204 192 L170 192 Z" fill="#FF3CAC" opacity=".45" filter="url(#nGlow)"/>
</g>
<g id="legFront">
  <path d="M120 130 L108 166 L136 170 L146 132 Z" fill="#1B2436" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M100 166 L142 168 L150 186 L94 186 Z" fill="#1D2739" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M104 186 L146 186 L144 192 L106 192 Z" fill="#FF3CAC" opacity=".55" filter="url(#nGlow)"/>
</g>
<g id="torso">
  <path d="M196 60 L106 52 L84 92 L92 136 L204 142 L216 96 Z" fill="url(#nBody)" stroke="#070A11" stroke-width="6" stroke-linejoin="round"/>
  <path d="M196 60 L216 96 L204 142 L186 144 L198 96 Z" fill="#4A5F82" opacity=".4"/>
  <path d="M110 60 L188 66 L192 78 L106 74 Z" fill="#3B4C6B" opacity=".65"/>
</g>
<g id="coreGlow"><g filter="url(#nGlowBig)"><circle cx="146" cy="100" r="34" fill="#FF3CAC" opacity=".45"/></g></g>
<g id="core">
  <circle cx="146" cy="100" r="28" fill="#080D16" stroke="#FF3CAC" stroke-width="4"/>
  <circle cx="146" cy="100" r="18" fill="#FF3CAC" opacity=".92" filter="url(#nGlow)"/>
  <circle cx="139" cy="93" r="6" fill="#FFD6EE" opacity=".8"/>
  <path d="M146 66 L146 78 M146 122 L146 134 M112 100 L124 100 M168 100 L180 100" stroke="#FF3CAC" stroke-width="3.4" opacity=".8" filter="url(#nGlow)"/>
</g>
<g id="clampArm">
  <path d="M84 92 L52 84 L40 108 L48 126 L86 122 Z" fill="#212D42" stroke="#070A11" stroke-width="6" stroke-linejoin="round"/>
  <path d="M52 84 L40 108 L48 126 L58 124 L52 106 Z" fill="#0A0E16" opacity=".5"/>
</g>
<g id="clampJaw">
  <path d="M40 96 L14 100 L12 116 L42 118 Z" fill="#050A11" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M38 100 L18 103 L17 113 L40 114 Z" fill="#2DE2E6" filter="url(#nGlow)"/>
  <path d="M20 104 L30 104.6 L30 112 L20 111.4 Z" fill="#EEFEFF" opacity=".85"/>
</g>
<g id="crest">
  <path d="M96 42 L60 6 L82 18 L112 40 Z" fill="#FF3CAC" opacity=".95" filter="url(#nGlow)"/>
  <path d="M112 40 L96 6 L118 22 L128 44 Z" fill="#FF3CAC" opacity=".6" filter="url(#nGlow)"/>
</g>
<g id="cannonArm">
  <path d="M196 60 L232 68 L248 96 L238 124 L206 118 Z" fill="#212D42" stroke="#070A11" stroke-width="6" stroke-linejoin="round"/>
  <path d="M240 78 L268 88 L266 106 L238 100 Z" fill="#141C2A" stroke="#070A11" stroke-width="5" stroke-linejoin="round"/>
  <path d="M266 90 L288 96 L286 104 L264 102 Z" fill="#0B1019" stroke="#070A11" stroke-width="4"/>
  <circle cx="284" cy="99" r="5" fill="#FF3CAC" filter="url(#nGlow)"/>
</g>
<g id="vents"><path d="M100 130 L128 126 M100 138 L200 134" stroke="#2DE2E6" stroke-width="2.6" opacity=".5"/></g>
<g id="shoulderVisor">
  <path d="M176 76 L196 80 L194 96 L174 92 Z" fill="#080D16" stroke="#2DE2E6" stroke-width="2.4"/>
  <path d="M180 80 L191 82 L190 92 L179 90 Z" fill="#2DE2E6" opacity=".8" filter="url(#nGlow)"/>
</g>`,
      notes:{
        walk:"지면을 울리는 보행. 기둥 다리를 힙(174,130)·(133,131) 축으로 ±14°만 교차시켜 무게를 표현하고(느린 주기), **접지 프레임마다 가슴 코어가 밝게 맥동**해 발소리가 시각화됩니다. 마젠타 백크레스트 핀 2장이 관성으로 크게 늦게 쓸리고 스러스터 솔이 번쩍입니다.",
        attack:"캐논 앙각 + 클램프 강타. 후방 캐논 팔이 어깨(206,84)를 축으로 -24° 앙각을 잡아 곡사 조준하고, 동시에 전방 클램프 팔이 30px 앞으로 내질러지며 집게(44,108)가 물어 닫힙니다. 가슴 코어가 1.5배로 눈부시게 충전됐다 방출되고, 거대 질량이 뒤로 밀려 다리가 버티며 미끄러집니다.",
        hit:"거체가 밀리지 않고 버팀. 상체만 젖혀지고 코어가 불규칙하게 깜빡이며 크레스트가 흔들립니다.",
        death:"보스 사망. 코어가 과부하로 급팽창했다 꺼지고, 무릎이 꺾인 뒤 발밑(150,188)을 축으로 천천히 뒤로 넘어집니다. 코어 → 클램프 → 크레스트 순으로 발광이 소실됩니다.",
        skill:"강제 청산 / 골드 흡수. 클램프 팔을 벌려 앞으로 내밀고 가슴 코어를 1.35배로 과충전해 흡수 볼텍스를 형성, 크레스트가 최대 발광합니다."
      },
      anim:(ph,mo,A)=>{
        const s=sin(PI2*ph);
        if(mo==="walk"){
          const bob=-3*Math.abs(s), step=Math.abs(s);
          A.set("legBack",{r:[-14*s,174,130]});
          A.set("legFront",{r:[13*s,133,131]});
          ["torso","vents","shoulderVisor"].forEach(id=>A.set(id,{t:[0,bob],r:[1.1*s,150,140]}));
          const cp=1+0.09*step;
          A.set("core",{t:[0,bob],s:[cp,cp,146,100]});
          A.set("coreGlow",{t:[0,bob],s:[cp*1.05,cp*1.05,146,100],o:0.35+0.3*step});
          A.set("crest",{t:[0,bob],r:[-11*sin(PI2*(ph-0.2)),104,40]});
          A.set("clampArm",{t:[0,bob],r:[-8*s,86,104]});
          A.set("clampJaw",{t:[0,bob],r:[-11*sin(PI2*(ph-0.1)),44,108]});
          A.set("cannonArm",{t:[0,bob],r:[7*s,206,84]});
          A.set("glow",{s:[1-0.03*step,1,150,190]});
        } else if(mo==="attack"){
          const swing=TR(ph,[[0,0],[.16,8],[.44,-24],[.66,-24],[.78,-14],[1,0]],"out");
          const rec=TR(ph,[[0,0],[.16,-4],[.5,16],[.7,9],[1,0]],"out");
          A.set("cannonArm",{r:[swing,206,84],t:[rec*0.6,0]});
          const thrust=TR(ph,[[0,0],[.16,10],[.48,-30],[.66,-22],[1,0]],"out");
          A.set("clampArm",{t:[thrust,0],r:[TR(ph,[[0,0],[.48,-12],[1,0]],"out"),86,104]});
          A.set("clampJaw",{t:[thrust*1.25,0],r:[TR(ph,[[0,0],[.32,-18],[.48,22],[.7,16],[1,0]],"out"),44,108]});
          const chg=TR(ph,[[0,1],[.3,1.15],[.44,1.3],[.5,1.5],[.56,1.05],[1,1]],"out");
          A.set("core",{s:[chg,chg,146,100],t:[rec,0]});
          A.set("coreGlow",{s:[chg*1.15,chg*1.15,146,100],o:0.35+0.5*(chg-1)/0.5,t:[rec,0]});
          ["torso","vents","shoulderVisor"].forEach(id=>A.set(id,{t:[rec,0],r:[TR(ph,[[0,0],[.5,-4],[1,0]],"out"),150,140]}));
          A.set("crest",{t:[rec,0],r:[TR(ph,[[0,0],[.5,20],[.78,-7],[1,0]],"out"),104,40]});
          A.set("legBack",{t:[rec*0.5,0],r:[TR(ph,[[0,0],[.5,13],[.8,5],[1,0]],"out"),174,130]});
          A.set("legFront",{t:[rec*0.5,0],r:[TR(ph,[[0,0],[.5,-11],[.8,-4],[1,0]],"out"),133,131]});
          A.set("glow",{t:[rec*0.5,0]});
        } else if(mo==="hit"){
          const k=TR(ph,[[0,0],[.08,1],[.2,.45],[.34,.7],[.55,0],[1,0]],"out");
          ["torso","vents","shoulderVisor"].forEach(id=>A.set(id,{t:[7*k,0],r:[5*k,150,140]}));
          A.set("core",{t:[7*k,0],o:0.4+0.6*Math.abs(sin(PI2*ph*9))});
          A.set("coreGlow",{t:[7*k,0],o:0.2+0.4*Math.abs(sin(PI2*ph*9))});
          A.set("crest",{r:[-18*k,104,40]});
          A.set("clampArm",{t:[8*k,0],r:[12*k,86,104]});
          A.set("clampJaw",{t:[9*k,0],r:[16*k,44,108]});
          A.set("cannonArm",{t:[8*k,0],r:[10*k,206,84]});
          A.set("legBack",{r:[7*k,174,130]});
          A.set("legFront",{r:[9*k,133,131]});
          A.filter(`brightness(${1+1.4*k}) saturate(${1-0.5*k})`);
        } else if(mo==="death"){
          const surge=TR(ph,[[0,1],[.14,1.5],[.24,1.75],[.34,0.12],[1,0.06]],"out");
          const kn=S(ph,.28,.5), fall=H.inn(S(ph,.46,.86)), fade=S(ph,.84,1);
          A.set("core",{s:[surge,surge,146,100],o:Math.max(0,Math.min(1,surge))});
          A.set("coreGlow",{s:[surge*1.2,surge*1.2,146,100],o:Math.max(0,0.45*Math.min(1.4,surge))});
          A.set("root",{r:[84*fall,150,188]});
          A.set("legBack",{r:[-32*kn+14*fall,174,130]});
          A.set("legFront",{r:[38*kn-16*fall,133,131]});
          ["torso","vents","shoulderVisor"].forEach(id=>A.set(id,{t:[0,12*kn],r:[6*kn,150,140]}));
          A.set("crest",{r:[24*fall,104,40],o:Math.max(0,0.95-1.1*fall)});
          A.set("clampArm",{t:[0,12*kn],r:[30*fall,86,104]});
          A.set("clampJaw",{t:[0,12*kn],r:[38*fall,44,108],o:Math.max(0,1-1.3*fall)});
          A.set("cannonArm",{t:[0,12*kn],r:[26*fall,206,84]});
          A.set("glow",{s:[1+0.16*fall,1-0.5*fade,150,190],o:Math.max(0,0.22-0.3*fall)});
          A.opacity(1-fade);
          A.filter(`saturate(${1-0.8*fall}) brightness(${1-0.35*fall})`);
        } else {
          const r=S(ph,0,.32), p=sin(PI2*ph);
          const cp=1+0.35*r+0.06*Math.abs(p);
          A.set("core",{s:[cp,cp,146,100]});
          A.set("coreGlow",{s:[cp*1.2,cp*1.2,146,100],o:0.4+0.4*Math.abs(p)});
          A.set("clampArm",{r:[-16*r,86,104],t:[-6*r,0]});
          A.set("clampJaw",{r:[-26*r,44,108],t:[-10*r,0]});
          A.set("crest",{r:[-10*r,104,40]});
          A.set("cannonArm",{r:[-8*r,206,84]});
          ["torso","vents","shoulderVisor"].forEach(id=>A.set(id,{r:[-2*r,150,140]}));
          A.set("legBack",{r:[10*r,174,130]});
          A.set("legFront",{r:[-10*r,133,131]});
          A.filter(`drop-shadow(0 0 ${10+12*Math.abs(p)}px rgba(255,60,172,${.45+.35*Math.abs(p)}))`);
        }
      }
    };

    H._rg19=[guardian,blade,ranger,lancer,cleric,mage,ballista,cannon,spire,breaker,flame,vault,drone,trooper,crawler,flash,hedge,algo,titan];
    return H._rg19;
}
export const RIGS = buildRigs();
